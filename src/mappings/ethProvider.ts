
import { Block, BlockTag, BlockWithTransactions, EventType, Filter, Listener, Log, Provider, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/abstract-provider';
import { Network } from '@ethersproject/networks';
import { Deferrable } from '@ethersproject/properties';
import { BigNumber, BigNumberish} from '@ethersproject/bignumber';
import { EthLog, EthRichBlock, EthTransaction } from '@polkadot/types/interfaces';

function ethTransactionToTransactionResponse(tx: EthTransaction): TransactionResponse {
  throw new Error('Method not implemented.');

  // Cant seem to get the commented props
  // return {
  //   ...tx,
  //   // hash: null,
  //   data: tx.input.toHex(),
  //   // from: null,
  //   // confirmations: 0,
  //   // chainId: null,
  //   wait: () => { throw new Error('Method not implemented')}
  // }
}

function ethRichBlockToBlock(b: EthRichBlock): Block {
  return {
    ...b,
    nonce: '0x',
    hash: b.blockHash.unwrap().toHex(),
    parentHash: b.parentHash.toHex(),
    number: b.number.unwrap().toNumber(),
    timestamp: b.timestamp.toNumber(),
    transactions: b.transactions.map(tx => tx.hash.toHex()),
    _difficulty: BigNumber.from(b.difficulty.toHex()),
    difficulty: b.difficulty.toNumber(),
    gasLimit: BigNumber.from(b.gasLimit.toHex()),
    gasUsed: BigNumber.from(b.gasUsed.toHex()),
    miner: b.miner.toHex(),
    extraData: b.extraData.toHex(),
  }
}

function ethLogToLog(log: EthLog): Log {
  return {
    ...log,
    blockNumber: log.blockNumber.unwrap().toNumber(),
    blockHash: log.blockHash.unwrap().toHex(),
    transactionIndex: log.transactionIndex.unwrap().toNumber(),
    transactionHash: log.transactionHash.unwrap().toHex(),
    removed: log.removed.isTrue,
    address: log.address.toHex(),
    data: log.data.toHex(),
    topics: log.topics.map(v => v.toHex()),
    logIndex: log.logIndex.unwrap().toNumber(),
  }
}

export default class FrontierEthProvider extends Provider {
  private eth = api.rpc.eth;

  async getBalance(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<BigNumber> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    const balance = await this.eth.getBalance(await addressOrName)
    return BigNumber.from(balance.toHex());
  }

  async getTransactionCount(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<number> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    return this.eth.getTransactionCount(await addressOrName).then(r => r.toNumber());
  }

  async getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    return this.eth.getCode(await addressOrName).then(r => r.toHex());
  }

  async getStorageAt(addressOrName: string | Promise<string>, position: BigNumberish | Promise<BigNumberish>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    return this.eth.getStorageAt(
      await addressOrName,
      BigNumber.from(await position).toBigInt()
    ).then(r => r.toHex());
  }

  async call(transaction: Deferrable<TransactionRequest>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
    if (blockTag) logger.warn(`Provided parameter 'blockTag' will not be used`);
    const r = await this.eth.call(transaction);
    return r.toHex();
  }

  async getBlockWithTransactions(blockHashOrBlockTag: BlockTag | Promise<BlockTag>): Promise<BlockWithTransactions> {
    const raw = await this.eth.getBlockByHash(blockHashOrBlockTag.toString(), true);

    const b = raw.unwrap();

    return {
      ...ethRichBlockToBlock(b),
      transactions: b.transactions.toArray()
        .map(ethTransactionToTransactionResponse),
    }
  }

  getBlock(blockHashOrBlockTag: BlockTag | Promise<BlockTag>): Promise<Block> {
    throw new Error('Method not supported.');
  }
  getTransaction(transactionHash: string): Promise<TransactionResponse> {
    throw new Error('Method not supported.');
  }
  getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt> {
    throw new Error('Method not supported.');
  }
  getLogs(filter: Filter): Promise<Log[]> {
    throw new Error('Method not supported.');
  }
  getBlockNumber(): Promise<number> {
    throw new Error('Method not supported.');
  }
  getNetwork(): Promise<Network> {
    throw new Error('Method not supported.');
  }
  getGasPrice(): Promise<BigNumber> {
    throw new Error('Method not supported.');
  }
  estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
    throw new Error('Method not supported.');
  }
  sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
    throw new Error('Method not supported.');
  }
  resolveName(name: string | Promise<string>): Promise<string | null> {
    throw new Error('Method not supported.');
  }
  lookupAddress(address: string | Promise<string>): Promise<string | null> {
    throw new Error('Method not supported.');
  }
  on(eventName: EventType, listener: Listener): Provider {
    throw new Error('Method not supported.');
  }
  once(eventName: EventType, listener: Listener): Provider {
    throw new Error('Method not supported.');
  }
  emit(eventName: EventType, ...args: any[]): boolean {
    throw new Error('Method not supported.');
  }
  listenerCount(eventName?: EventType): number {
    throw new Error('Method not supported.');
  }
  listeners(eventName?: EventType): Listener[] {
    throw new Error('Method not supported.');
  }
  off(eventName: EventType, listener?: Listener): Provider {
    throw new Error('Method not supported.');
  }
  removeAllListeners(eventName?: EventType): Provider {
    throw new Error('Method not supported.');
  }
  waitForTransaction(transactionHash: string, confirmations?: number, timeout?: number): Promise<TransactionReceipt> {
    throw new Error('Method not supported.');
  }
}