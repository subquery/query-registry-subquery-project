// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { MoonbeamEvent } from '@subql/contract-processors/dist/moonbeam';
import { Deployment, Indexer, Project, Status } from '../types';
import bs58 from 'bs58';

import {
    CreateQueryEvent,
    StartIndexingEvent,
    UpdateDeploymentStatusEvent,
    StopIndexingEvent,
    UpdateQueryMetadataEvent,
    UpdateQueryDeploymentEvent,
    UpdateIndexingStatusToReadyEvent
} from '@subql/contract-sdk/typechain/QueryRegistry';
import { ProjectDeployment } from '../types/models/ProjectDeployment';
import {BigNumber} from '@ethersproject/bignumber';

function bytesToIpfsCid(raw: string): string {
    // Add our default ipfs values for first 2 bytes:
    // function:0x12=sha2, size:0x20=256 bits
    // and cut off leading "0x"
    const hashHex = "1220" + raw.slice(2);
    const hashBytes = Buffer.from(hashHex, 'hex');
    return bs58.encode(hashBytes);
}

function bnToDate(bn: BigNumber): Date {
    return new Date(bn.toNumber() * 1000);
}

export async function handleNewQuery(event: MoonbeamEvent<CreateQueryEvent['args']>): Promise<void> {

    const projectId = event.args.queryId.toHexString();
    const deploymentId = bytesToIpfsCid(event.args.deploymentId);
    const currentVersion = bytesToIpfsCid(event.args.version);

    const projectDeployment = ProjectDeployment.create({
        id: `${projectId}-${deploymentId}`,
        projectId: projectId,
        deploymentId,
    });

    let deployment = await Deployment.get(deploymentId);

    if (!deployment) {
        deployment = Deployment.create({
            id: deploymentId,
            version: currentVersion,
        });

        await deployment.save();
    }

    const project = Project.create({
        id: projectId,
        owner: event.args.creator,
        metadata: bytesToIpfsCid(event.args.metadata),
        currentDeployment: deploymentId,
        currentVersion,
        updatedTimestamp: event.blockTimestamp,
        createdTimestamp: event.blockTimestamp,
    });

    await project.save();
    await projectDeployment.save();
}

export async function handleUpdateQueryMetadata(event: MoonbeamEvent<UpdateQueryMetadataEvent['args']>): Promise<void> {
    const queryId = event.args.queryId.toHexString();
    const project = await Project.get(queryId);

    project.metadata = bytesToIpfsCid(event.args.metadata);
    project.updatedTimestamp = event.blockTimestamp;

    await project.save();
}

export async function handleUpdateQueryDeployment(event: MoonbeamEvent<UpdateQueryDeploymentEvent['args']>): Promise<void> {
    const queryId = event.args.queryId.toHexString();
    const deploymentId = bytesToIpfsCid(event.args.deploymentId);
    const version = bytesToIpfsCid(event.args.version);
    const projectDeploymentId = `${queryId}-${deploymentId}`;

    let deployment = await Deployment.get(deploymentId);
    if (!deployment) {
        deployment = Deployment.create({
            id: deploymentId,
            version,
            createdTimestamp: event.blockTimestamp,
        });

        await deployment.save();
    }

    let projectDeployment = await ProjectDeployment.get(projectDeploymentId);
    if (!projectDeployment) {
        projectDeployment = ProjectDeployment.create({
            id: projectDeploymentId,
            projectId: queryId,
            deploymentId,
        });

        await projectDeployment.save();
    }

    const project = await Project.get(queryId);

    project.currentDeployment = deploymentId;
    project.currentVersion = version;
    project.updatedTimestamp = event.blockTimestamp;

    await project.save();
}

export async function handleStartIndexing(event: MoonbeamEvent<StartIndexingEvent['args']>): Promise<void> {
    const deploymentId = bytesToIpfsCid(event.args.deploymentId);
    const indexer = Indexer.create({
        id: `${event.args.indexer}-${deploymentId}`,
        indexer: event.args.indexer,
        deploymentId: deploymentId,
        blockHeight: BigInt(0),
        status: Status.INDEXING,
    });
    await indexer.save();
}

export async function handleIndexingUpdate(event: MoonbeamEvent<UpdateDeploymentStatusEvent['args']>): Promise<void> {
    const deploymentId = bytesToIpfsCid(event.args.deploymentId);
    const indexer = await Indexer.get(`${event.args.indexer}-${deploymentId}`);
    indexer.blockHeight = event.args.blockheight.toBigInt();
    indexer.mmrRoot = event.args.mmrRoot;
    indexer.timestamp = bnToDate(event.args.timestamp);
    await indexer.save();
}

export async function handleIndexingReady(event: MoonbeamEvent<UpdateIndexingStatusToReadyEvent['args']>): Promise<void> {
    const deploymentId = bytesToIpfsCid(event.args.deploymentId);
    const indexer = await Indexer.get(`${event.args.indexer}-${deploymentId}`);
    indexer.status = Status.READY;
    indexer.timestamp = bnToDate(event.args._timestamp);
    await indexer.save();
}

export async function handleStopIndexing(event: MoonbeamEvent<StopIndexingEvent['args']>): Promise<void> {
    const deploymentId = bytesToIpfsCid(event.args.deploymentId);
    const indexer = await Indexer.get(`${event.args.indexer}-${deploymentId}`);
    indexer.status = Status.TERMINATED;
    await indexer.save();

    // TODO remove indexer instead?
}
