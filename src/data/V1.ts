import { Contract } from '@ethersproject/contracts'
import { Token, TokenAmount, Pair, Trade, ChainId, VVET, Route, TradeType, Percent } from 'vexchange-sdk'
import useSWR from 'swr'
import { useWeb3React } from '../hooks'

import IUniswapV1Factory from '../constants/abis/v1_factory.json'
import { V1_FACTORY_ADDRESS } from '../constants'
import { useContract } from '../hooks'
import { SWRKeys } from '.'
import { useETHBalances, useTokenBalances } from '../state/wallet/hooks'

function getV1PairAddress(contract: Contract): (tokenAddress: string) => Promise<string> {
  return async (tokenAddress: string): Promise<string> => contract.getExchange(tokenAddress)
}

function useV1PairAddress(tokenAddress: string) {
  const { chainId } = useWeb3React()

  const contract = useContract(V1_FACTORY_ADDRESS, IUniswapV1Factory, false)

  const shouldFetch = chainId === ChainId.MAINNET && typeof tokenAddress === 'string' && !!contract
  const { data } = useSWR(shouldFetch ? [tokenAddress, SWRKeys.V1PairAddress] : null, getV1PairAddress(contract), {
    // don't need to update this data
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })

  return data
}

function useMockV1Pair(token?: Token) {
  const isWETH = token?.equals(VVET[token?.chainId])

  // will only return an address on mainnet, and not for VVET
  const v1PairAddress = useV1PairAddress(isWETH ? undefined : token?.address)
  const tokenBalance = useTokenBalances(v1PairAddress, [token])[token?.address]
  const ETHBalance = useETHBalances([v1PairAddress])[v1PairAddress]

  return tokenBalance && ETHBalance
    ? new Pair(tokenBalance, new TokenAmount(VVET[token?.chainId], ETHBalance.toString()))
    : undefined
}

export function useV1TradeLinkIfBetter(
  isExactIn: boolean,
  inputToken: Token,
  outputToken: Token,
  exactAmount: TokenAmount,
  v2Trade: Trade,
  minimumDelta: Percent = new Percent('0')
): string {
  const { chainId } = useWeb3React()

  const input = inputToken
  const output = outputToken
  const mainnet = chainId === ChainId.MAINNET

  // get the mock v1 pairs
  const inputPair = useMockV1Pair(input)
  const outputPair = useMockV1Pair(output)

  const inputIsWETH = mainnet && input?.equals(VVET[ChainId.MAINNET])
  const outputIsWETH = mainnet && output?.equals(VVET[ChainId.MAINNET])

  // construct a direct or through ETH v1 route
  let pairs: Pair[]
  if (inputIsWETH && outputPair) {
    pairs = [outputPair]
  } else if (outputIsWETH && inputPair) {
    pairs = [inputPair]
  }
  // if neither are VVET, it's token-to-token (if they both exist)
  else if (inputPair && outputPair) {
    pairs = [inputPair, outputPair]
  }

  const route = pairs && new Route(pairs, input)
  const v1Trade =
    route && exactAmount
      ? new Trade(route, exactAmount, isExactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT)
      : undefined

  let v1HasBetterTrade = false
  if (v1Trade) {
    if (isExactIn) {
      // discount the v1 output amount by minimumDelta
      const discountedV1Output = v1Trade?.outputAmount.multiply(new Percent('1').subtract(minimumDelta))
      // check if the discounted v1 amount is still greater than v2, short-circuiting if no v2 trade exists
      v1HasBetterTrade = !!!v2Trade || discountedV1Output.greaterThan(v2Trade.outputAmount)
    } else {
      // inflate the v1 amount by minimumDelta
      const inflatedV1Input = v1Trade?.inputAmount.multiply(new Percent('1').add(minimumDelta))
      // check if the inflated v1 amount is still less than v2, short-circuiting if no v2 trade exists
      v1HasBetterTrade = !!!v2Trade || inflatedV1Input.lessThan(v2Trade.inputAmount)
    }
  }

  return v1HasBetterTrade
    ? `https://vexchange.io/swap?inputCurrency=${inputIsWETH ? 'VET' : input.address}&outputCurrency=${
        outputIsWETH ? 'VET' : output.address
      }`
    : undefined
}
