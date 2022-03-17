// Copyright 2020-2022 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { EraManager__factory } from '@subql/contract-sdk';
import {
  DelegationAddedEvent,
  DelegationRemovedEvent,
  UnbondRequestedEvent,
  UnbondWithdrawnEvent,
  SetCommissionRateEvent,
} from '@subql/contract-sdk/typechain/Staking';
import assert from 'assert';
import { Delegation, Withdrawl, Indexer } from '../types';
import FrontierEthProvider from './ethProvider';
import {
  ERA_MANAGER_ADDRESS,
  updateTotalStake,
  upsertEraValue,
  updateTotalDelegation,
} from './utils';
import { BigNumber } from '@ethersproject/bignumber';
import { FrontierEvmEvent } from '@subql/contract-processors/dist/frontierEvm';

function getDelegationId(delegator: string, indexer: string): string {
  return `${delegator}:${indexer}`;
}

function getWithdrawlId(delegator: string, index: BigNumber): string {
  return `${delegator}:${index.toHexString()}`;
}

export async function handleAddDelegation(
  event: FrontierEvmEvent<DelegationAddedEvent['args']>
): Promise<void> {
  logger.info('handleAddDelegation');
  assert(event.args, 'No event args');

  const { source, indexer, amount } = event.args;
  const id = getDelegationId(source, indexer);
  const eraManager = EraManager__factory.connect(
    ERA_MANAGER_ADDRESS,
    new FrontierEthProvider()
  );

  const amountBn = amount.toBigInt();

  await updateTotalDelegation(
    eraManager,
    source,
    amountBn,
    'add',
    indexer === source
  );

  let delegation = await Delegation.get(id);

  if (!delegation) {
    // Indexers first stake is effective immediately
    const eraAmount = await upsertEraValue(
      eraManager,
      undefined,
      amountBn,
      'add',
      indexer === source
    );

    delegation = Delegation.create({
      id,
      delegatorAddress: source,
      delegatorId: source,
      indexerAddress: indexer,
      indexerId: indexer,
      amount: eraAmount,
    });

    await updateTotalStake(
      eraManager,
      indexer,
      amountBn,
      'add',
      indexer === source
    );
  } else {
    delegation.amount = await upsertEraValue(
      eraManager,
      delegation.amount,
      amountBn
    );

    await updateTotalStake(eraManager, indexer, amountBn, 'add');
  }

  await delegation.save();
}

export async function handleRemoveDelegation(
  event: FrontierEvmEvent<DelegationRemovedEvent['args']>
): Promise<void> {
  logger.info('handleRemoveDelegation');
  assert(event.args, 'No event args');

  const { source, indexer, amount } = event.args;
  const id = getDelegationId(source, indexer);
  const eraManager = EraManager__factory.connect(
    ERA_MANAGER_ADDRESS,
    new FrontierEthProvider()
  );

  const delegation = await Delegation.get(id);
  logger.warn(`DELEGATION ${JSON.stringify(delegation)}`);

  const delegatorDelegations = await Delegation.getByDelegatorId(source);

  logger.warn(`COUNT DELEGATOR DELEGATIONS: ${delegatorDelegations?.length}`);
  delegatorDelegations?.forEach((d) => {
    logger.warn(`DELEGATOR DELEGATION ID ${d.id}`);
  });

  assert(delegation, `Expected delegation (${id}) to exist`);

  delegation.amount = await upsertEraValue(
    eraManager,
    delegation.amount,
    amount.toBigInt(),
    'sub'
  );

  await updateTotalDelegation(eraManager, source, amount.toBigInt(), 'sub');
  await updateTotalStake(eraManager, indexer, amount.toBigInt(), 'sub');

  await delegation.save();
}

/* TODO wait for new contracts */
export async function handleWithdrawRequested(
  event: FrontierEvmEvent<UnbondRequestedEvent['args']>
): Promise<void> {
  logger.info('handleWithdrawRequested');
  assert(event.args, 'No event args');

  const { source, indexer, index, amount } = event.args;
  const id = getWithdrawlId(source, index);

  const withdrawl = Withdrawl.create({
    id,
    delegator: source,
    indexer,
    index: index.toBigInt(),
    startTime: event.blockTimestamp,
    amount: amount.toBigInt(),
    claimed: false,
  });

  await withdrawl.save();
}

export async function handleWithdrawClaimed(
  event: FrontierEvmEvent<UnbondWithdrawnEvent['args']>
): Promise<void> {
  logger.info('handleWithdrawClaimed');
  assert(event.args, 'No event args');

  const { source, index } = event.args;
  const id = getWithdrawlId(source, index);

  const withdrawl = await Withdrawl.get(id);
  assert(withdrawl, `Expected withdrawl (${id}) to exist`);

  withdrawl.claimed = true;

  await withdrawl.save();
}

export async function handleSetCommissionRate(
  event: FrontierEvmEvent<SetCommissionRateEvent['args']>
): Promise<void> {
  logger.info('handleSetCommissionRate');
  assert(event.args, 'No event args');

  const address = event.args.indexer;
  const eraManager = EraManager__factory.connect(
    ERA_MANAGER_ADDRESS,
    new FrontierEthProvider()
  );

  const indexer = await Indexer.get(address);
  assert(indexer, `Expected indexer (${address}) to exist`);

  indexer.commission = await upsertEraValue(
    eraManager,
    indexer.commission,
    event.args.amount.toBigInt(),
    'replace',
    // Apply instantly when era is -1, this is an indication that indexer has just registered
    indexer.commission.era === -1
  );

  await indexer.save();
}
