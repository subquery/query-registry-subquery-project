import bs58 from 'bs58';
import {BigNumber} from '@ethersproject/bignumber';
import { EraManager } from '@subql/contract-sdk';
import { Indexer, EraValue, JSONBigInt } from '../types';


// TODO get this from contract-sdk when network is bundled
export const ERA_MANAGER_ADDRESS = '0xED8f079e89717A94ff9E72F04A8e2775161024FF';
export const PLAN_MANAGER_ADDRESS = '0xF7212a9D6468709a954A34125A3A9d14D6db083e';
export const SA_REGISTRY_ADDRESS = '0xAd9Ec6BDB97798C43BF4dab638ba14F794B15859';

declare global {
    interface BigIntConstructor {
        fromJSONType(value: unknown): bigint;
    }
    interface BigInt {
        toJSON(): string;
        toJSONType(): JSONBigInt;
        fromJSONType(value: unknown): bigint;
    }
}


BigInt.prototype.toJSON = function() {
    return BigNumber.from(this).toHexString();
}

BigInt.prototype.toJSONType = function() {
    return {
        type: 'bigint',
        value: this.toJSON(),
    };
}

BigInt.fromJSONType = function(value: JSONBigInt): bigint {
    if (value?.type !== 'bigint' && !value.value) {
        throw new Error('Value is not JSOBigInt');
    }

    return BigNumber.from(value.value).toBigInt();
}


export function bytesToIpfsCid(raw: string): string {
    // Add our default ipfs values for first 2 bytes:
    // function:0x12=sha2, size:0x20=256 bits
    // and cut off leading "0x"
    const hashHex = "1220" + raw.slice(2);
    const hashBytes = Buffer.from(hashHex, 'hex');
    return bs58.encode(hashBytes);
}

export function bnToDate(bn: BigNumber): Date {
    return new Date(bn.toNumber() * 1000);
}


export const operations: Record<string, (a: bigint, b: bigint) => bigint> = {
    add: (a, b) => a + b,
    sub: (a, b) => a - b,
    replace: (a, b) => b,
}

export async function upsertEraValue(
    eraManager: EraManager,
    eraValue: EraValue | undefined,
    value: bigint,
    operation: keyof typeof operations = 'add'
): Promise<EraValue> {

    const currentEra = await eraManager.eraNumber().then(r => r.toNumber()); // TODO get from chain

    if (!eraValue) {
        return {
            era: currentEra,
            value: BigInt(0).toJSONType(),
            valueAfter: value.toJSONType(),
        }
    }

    if (eraValue.era === currentEra) {
        BigInt.fromJSONType(eraValue.valueAfter)
        return {
            era: currentEra,
            value: eraValue.value,
            valueAfter: operations[operation](
                BigInt.fromJSONType(eraValue.valueAfter),
                value
            ).toJSONType(),
        }
    }

    return {
        era: currentEra,
        value: eraValue.valueAfter,
        valueAfter: operations[operation](
            BigInt.fromJSONType(eraValue.valueAfter),
            value
        ).toJSONType(),
    };
}

export async function updateTotalStake(
    eraManager: EraManager,
    indexerAddress: string,
    amount: bigint,
    operation: keyof typeof operations
): Promise<void> {

    let indexer = await Indexer.get(indexerAddress);

    if (!indexer) {
        indexer = Indexer.create({
            id: indexerAddress,
            totalStake: await upsertEraValue(eraManager, undefined, amount, operation),
            commission: await upsertEraValue(eraManager, undefined, BigInt(0)),
        });
    } else {
        indexer.totalStake = await upsertEraValue(eraManager, indexer.totalStake, amount, operation);
    }

    await indexer.save();
}
