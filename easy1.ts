import ccxt from 'ccxt'
import axios from 'axios'
import config from './config'

(async () => {

  const exchange = new ccxt.bitflyer({
    apiKey: config.apiKey,
    secret: config.secret
  })

  /**
    設定値
  */

  // トレードボリューム
  const tradeVolume = 0.01

  // 現在のトレード情報
  type Side = 'BUY' | 'SELL' | 'NONE'

  // 期間
  const PERIOD = 20

  interface TradeStatus {
    side: Side
    volume: number
  }

  // トレード情報の初期化
  let tradeStatus: TradeStatus = { side: 'NONE', volume: 0 }

  // [タイムスタンプ,始値,高値,安値,終値,出来高,???]
  type OHLC<T> = [T, T, T, T, T, T, T]

  /**
   * ループ開始
   */
  while(true) {

    // 5分足のローソク足データを取得
    const response = await axios.get('https://api.cryptowat.ch/markets/bitflyer/btcfxjpy/ohlc?periods=300')
    const ohlc: OHLC<number>[] = response.data.result[300]

    // 現在の単純移動平均価格
    const currentAverage = sma(0, PERIOD, ohlc)

    // 現在の価格
    let currentPrice = prices(ohlc)[prices(ohlc).length - 1]

    // 注文が無ければポジションを持ちに行く
    // ポジションがあれば、決済しに行く
    if(tradeStatus.side === 'NONE') {
      await tryOpen(currentPrice, currentAverage) // 注文
    } else {
      await tryClose(currentPrice, currentAverage) // 決済(手仕舞い)
    }

    // 途転注文
    if(tradeStatus.side === 'NONE') {
      await tryOpen(currentPrice, currentAverage) // 注文
    }

    // 10秒待機
    await sleep(10 * 1000)

  }

  /**
   * ループ終了
   */

  /*
  ここから関数の記述
  */

  // tradeInfoの初期化
  function initTradeStatus(): void {
    tradeStatus = {
      side: 'NONE',
      volume: 0
    }
  }

  // エントリーしに行く
  async function tryOpen(currentPrice: number, currentAverage: number) {
    // 現在価格が、単純移動平均線より上にある場合→買う
    if(currentAverage < currentPrice)
    {
      // let result = await exchange.createMarketBuyOrder('FX_BTC_JPY', tradeVolume)
      // 注文が確定成功したら買い注文フラグを立てる
      // if(!result.id) return
      tradeStatus.side = 'BUY'
      tradeStatus.volume = tradeVolume
    }

    // 現在価格が、単純移動平均線(期間n分)より下にある場合→買う
    if(currentAverage > currentPrice)
    {
      // let result = await exchange.createMarketSellOrder('FX_BTC_JPY', tradeVolume)
      // 注文が確定成功したら売り注文フラグを立てる
      // if(result.id) return
      tradeStatus.side = 'SELL'
      tradeStatus.volume = tradeVolume
    }
  }

  // 決済しに行く
  async function tryClose(currentPrice: number, currentAverage: number) {
    // 売り注文の状態＆現在価格が、単純移動平均線(期間n分)より上→買う
    if(tradeStatus.side === 'SELL' && currentAverage < currentPrice)
    {
      console.log('買い注文開始', tradeStatus)
      // const result = await exchange.createMarketBuyOrder('FX_BTC_JPY', tradeVolume)
      // 注文が確定成功したらステータスを更新
      // if(result.id) return
      initTradeStatus()
      console.log('買い注文完了', tradeStatus)
    }

    // 買い注文の状態＆現在価格が、単純移動平均線(期間n分)より下→売る
    if(tradeStatus.side === 'BUY' && currentAverage > currentPrice)
    {
      console.log('売り注文開始', tradeStatus)
      // const result = await exchange.createMarketSellOrder('FX_BTC_JPY', tradeVolume)
      // 注文が確定成功したらステータスを更新
      // if(result.id) return
      initTradeStatus()
      console.log('売り注文完了', tradeStatus)
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
    Math.abs(index)

    let array = prices(ohlc).reverse()

    // indexから始めてperiod分の配列を取得
    array.slice(index, index + period)

    // 配列要素を合計する
    const sum = array.reduce((accumulator, value) => accumulator + value, 0)

    return sum / period
  }

  function sleep(time: number) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, time);
  });
}

})()

/*
以下の関数は今回は未使用
*/

// 上昇トレンド判定
// 移動平均線10期間前 < 5期間前 < 現在
// function isBullMarket(): boolean {
// 	return averageBefore20 < averageBefore7 && averageBefore7 < currentAverage
// }

// 下降トレンド判定
// 移動平均線20期間前 > 7期間前 > 現在
// function isBearMarket(): boolean {
// 	return sma(-20, period) > sma(-7, period) && sma(-7, period) > sma(0, period)
// }
