const fs = require('fs')

const logPath = "./log/log.txt"

// ファイルの追記関数
function appendFile(path: any, data: any) {
  fs.appendFile(path, data, function (err: any) {
    if (err) {
        throw err
    }
  })
}

//使用例
appendFile(logPath, "Append\n")
