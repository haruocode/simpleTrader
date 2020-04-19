import ccxt from 'ccxt'
import axios from 'axios'
import config from './config'

(async () => {

  // const exchange = new ccxt.bitflyer({
  //   apiKey: config.apiKey,
  //   secret: config.secret
  // })

  /**
    設定値
  */

  type Env = 'development' | 'production'
  const env: Env = 'development'

  const symbol = 'FX_BTC_JPY'

  // トレードボリューム(単位BTC)
  const tradeVolume = 0.01

  // 現在のトレード情報
  type Side = 'BUY' | 'SELL' | 'NONE'

  // 単純移動平均線の期間
  const PERIOD = 20

  // トレード情報
  // side 買い or 売り or 未注文
  // volume トレードボリューム
  interface TradeStatus {
    side: Side
    volume: number
    price: number
  }

  // トレード情報の初期化
  let tradeStatus: TradeStatus = { side: 'NONE', volume: 0, price: 0 }

  // CryptWatchから返ってくるレスポンス(ローソク足)情報の型
  // [タイムスタンプ,始値,高値,安値,終値,出来高,不明]
  type OHLC<T> = [T, T, T, T, T, T, T]

  // カウンター
  let counter = 0

  /**
   * ループ開始
   */
  while(true) {

    // 5分足のローソク足データを取得
    // periodsの値は秒数
    const response = await axios.get('https://api.cryptowat.ch/markets/bitflyer/btcfxjpy/ohlc?periods=300')
    const ohlc: OHLC<number>[] = response.data.result[300]

    // 現在の単純移動平均価格
    const currentAverage = sma(-1, PERIOD, ohlc)

    // 現在のBTCの価格(=1本前のローソク足の終値)
    let currentPrice = prices(ohlc)[(prices(ohlc).length - 1) - 1]

    // ポジションが無ければポジションを持ちに行く
    // ポジションを持っていれば、決済しに行く
    if(tradeStatus.side === 'NONE') {
      await tryOpen(currentPrice, currentAverage) // 注文
    } else {
      await tryClose(currentPrice, currentAverage) // 決済
    }

    // 途転注文
    if(tradeStatus.side === 'NONE') {
      await tryOpen(currentPrice, currentAverage) // 注文
    }

    // 5分に1回
    // 現在価格とSMAを表示
    if(counter >= 6){
      console.log(currentPrice, currentAverage)
      counter = 0
    }

    // 10秒待機
    await sleep(10 * 1000)

    // カウントアップ
    counter++
  }

  /**
   * ループ終了
   */

  /**
   * 関数定義
   */

  // tradeInfoの初期化
  function initTradeStatus(price: number): void {
    tradeStatus = {
      side: 'NONE',
      volume: 0,
      price
    }
  }

  // エントリーしに行く
  async function tryOpen(currentPrice: number, currentAverage: number) {
    // 現在価格が、単純移動平均線(SMA)より上にある場合→買う
    if(currentAverage < currentPrice)
    {
      if(env === 'production') {
        // let result = await exchange.createMarketBuyOrder(symbol, tradeVolume)
        // console.log(result)
      }
      // 注文が確定成功したら買い注文フラグを立てる
      tradeStatus.side = 'BUY'
      tradeStatus.volume = tradeVolume
      tradeStatus.price = currentPrice
      console.log('買い注文完了', tradeStatus)
    }

    // 現在価格が、単純移動平均線(期間n分)より下にある場合→売る
    if(currentAverage > currentPrice)
    {
      if(env === 'production') {
        // let result = await exchange.createMarketSellOrder(symbol, tradeVolume)
        // console.log(result)
      }
      // 注文が確定成功したら売り注文フラグを立てる
      tradeStatus.side = 'SELL'
      tradeStatus.volume = tradeVolume
      tradeStatus.price = currentPrice
      console.log('売り注文完了', tradeStatus)
    }
  }

  // 決済しに行く
  async function tryClose(currentPrice: number, currentAverage: number) {
    let profitLoss: unknown

    // 売り注文の状態＆現在価格が、単純移動平均線(期間n分)より上→買う
    if(tradeStatus.side === 'SELL' && currentAverage < currentPrice)
    {
      if(env === 'production') {
        // const result = await exchange.createMarketBuyOrder('FX_BTC_JPY', tradeVolume)
        // console.log(result)
      }
      // 注文が確定成功したらステータスを更新
      profitLoss = getProfit('SELL', tradeStatus.price, currentPrice, tradeStatus.volume)
      initTradeStatus(currentPrice)
      console.log('買い注文完了', tradeStatus)
      console.log('損益', profitLoss)
    }

    // 買い注文の状態＆現在価格が、単純移動平均線(期間n分)より下→売る
    if(tradeStatus.side === 'BUY' && currentPrice < currentAverage )
    {
      if(env === 'production') {
        // const result = await exchange.createMarketSellOrder('FX_BTC_JPY', tradeVolume)
        // console.log(result)
      }
      // 注文が確定成功したらステータスを更新
      profitLoss = getProfit('BUY', tradeStatus.price, currentPrice, tradeStatus.volume)
      initTradeStatus(currentPrice)
      console.log('売り注文完了', tradeStatus)
      console.log('損益', profitLoss)
    }
  }

  // 価格データから終値の価格配列を作る
  // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/map
  function prices(ohlc: OHLC<number>[]): number[] {
    return ohlc.map((item) => item[4])
  }

  // SMA
  // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Math/abs
  // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce
  // period 期間n
  //
  function sma(index: number, period: number, ohlc: OHLC<number>[]): number {
    index = Math.abs(index)

    let array = prices(ohlc).reverse()

    // indexから始めてperiod分の配列を取得
    array = array.slice(index, index + period)

    // 配列要素を合計する
    const sum = array.reduce((accumulator, value) => accumulator + value, 0)

    return sum / period
  }

  // 利益を計算する
  function getProfit(side: 'BUY' | 'SELL', openPrice: number, closePrice: number, volume: number): number {
    return (side === 'BUY') ? (closePrice - openPrice) * volume : (openPrice - closePrice) * volume
  }

  function sleep(time: number) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, time);
    })
  }

})()
