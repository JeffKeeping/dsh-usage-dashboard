# DSH 鐢ㄩ噺鐪嬫澘 路 dsh-usage-dashboard

DeepSeek Harness 鐨勬闈㈢鐢ㄩ噺鍙鍖栫湅鏉挎彃浠躲€備晶杈规爮涓€涓浘鏍囷紝鐐瑰紑灏辨槸涓€鏁撮〉鐨?Token 鐢ㄩ噺銆佽垂鐢ㄤ及绠椼€佽处鎴蜂綑棰濄€佷娇鐢ㄨ秼鍔垮拰妯″瀷鍗犳瘮 鈥斺€?鎵€鏈夋暟瀛楅兘浠庝綘鑷繁鐨勪細璇濇棩蹇楅噷瀹炴椂绠楀嚭鏉ャ€?
![鐢ㄩ噺鐪嬫澘](docs/screenshot.png)

## 鍔熻兘

| 鍖哄煙 | 鍐呭 |
|---|---|
| **璇绘暟鏉?* | Token 鎬婚噺锛堝惈璋冪敤娆℃暟涓庣紦瀛樺懡涓巼锛夈€佷粖鏃ヨ垂鐢ㄣ€佹湰鏈堣垂鐢ㄣ€佸巻鍙茬疮璁¤垂鐢ㄣ€丄PI 浣欓锛堝厖鍊奸挶鍖?+ 璧犻€侀搴︼紱鏈櫥褰曟椂鏄剧ず鐘舵€佽€屼笉鏄姤閿欙級 |
| **Token 鏋勬垚** | 鍫嗗彔姣斾緥鏉?+ 鏄庣粏琛細杈撳叆锛堟湭鍛戒腑缂撳瓨锛? 杈撳嚭 / 缂撳瓨鍛戒腑 / 缂撳瓨鍐欏叆锛屽悇鑷暟閲忎笌鍗犳瘮锛屽簳閮ㄧ粰鍑虹紦瀛樺懡涓巼 |
| **妯″瀷鍗犳瘮** | 鎸夋€?Token 鎺掑簭鐨勬ā鍨嬩唤棰濇潯锛屽惈 Token 鏁颁笌鍚勬ā鍨嬭垂鐢紱鍚屼竴妯″瀷璺ㄥ涓?provider 浼氳嚜鍔ㄥ悎骞讹紝鎮仠鍙湅鏉ユ簮 |
| **浣跨敤瓒嬪娍** | 骞虫粦鎶樼嚎锛堝崟璋冧笁娆℃彃鍊硷紝闆剁敤閲忔棩涓嶄細琚敾鍒板熀绾夸互涓嬶級+ 鎮诞鍗佸瓧绾?+ 褰撴棩鏄庣粏鍗＄墖锛? / 30 / 90 / 182 澶╁彲鍒囨崲锛宍鈫恅 `鈫抈 閫愭棩绉诲姩 |
| **娲昏穬鐑姏鍥?* | 杩戝崐骞撮€愭棩鏂规牸锛岄鑹茶秺娣辩敤閲忚秺澶э紱鎮仠鏍煎瓙浼氭弿杈归珮浜紝骞跺湪涓嬫柟鍥句緥琛屽師浣嶆樉绀哄綋澶╂槑缁嗭紙娴眰涓嶄細閬尅缃戞牸锛?|

鎶樼嚎涓庣儹鍔涘浘缁熶竴浣跨敤 DeepSeek 钃濋厤鑹查樁 `#dff2fe 鈫?#a0dcfd 鈫?#60b3fe 鈫?#0c70f3`锛涘叾浣欑粨鏋勪笌鎺т欢鍏ㄩ儴娌跨敤瀹夸富涓婚 token锛坄--dsw-alias-*`锛夛紝浜壊/鏆楄壊鑷姩璺熼殢銆?
## 瀹夎

### 瀹夎鍚庨暱浠€涔堟牱

- 渚ц竟鏍忓簳閮ㄣ€佽缃笂鏂癸紝澶氬嚭涓€涓煴鐘跺浘鍥炬爣
- 鐐瑰嚮瀹冿紝涓爮鏁撮〉鍙樻垚鐪嬫澘
- 鎻掍欢绠＄悊椤甸噷鑳界湅鍒般€岀敤閲忕湅鏉裤€嶆潯鐩強鍏跺浘鏍?
### 鐜瑕佹眰

- DeepSeek Harness Desktop锛?.2.x锛?- 鑺傜偣杩愯鏃?`>= 20`

### 瀹夎鏂瑰紡

**鏂瑰紡涓€锛氭湰鍦扮洰褰曞畨瑁咃紙鎺ㄨ崘锛屾敼浠ｇ爜鍗虫椂鐢熸晥锛?*

```bash
git clone https://github.com/JeffKeeping/dsh-usage-dashboard.git
```

鐒跺悗鍦?Harness 閲屾墽琛岋紙鎶婅矾寰勬崲鎴愪綘鐨勫疄闄呭厠闅嗚矾寰勶級锛?
```
plugin_manager action=install_bundle target=<缁濆璺緞>/dsh-usage-dashboard
```

鎴栫敤 CLI锛?
```bash
dsh plugin install <缁濆璺緞>/dsh-usage-dashboard
```

瀹夎绔嬪嵆鐢熸晥銆傝嫢鐣岄潰杩樻病鍒锋柊鍑烘柊鐨勪晶杈规爮鍥炬爣锛屾寜 `Ctrl+R` 鍒锋柊涓€娆＄獥鍙ｏ紙瀹㈡埛绔唬鐮佹槸妯″潡鍖栧姞杞界殑锛屽埛鏂板悗鎵嶆崲鎴愮鐩樹笂鐨勬渶鏂扮増鏈級銆?
**鏂瑰紡浜岋細浠?npm 瀹夎**

```bash
dsh plugin install dsh-usage-dashboard
```

### 楠岃瘉瀹夎

```bash
curl http://127.0.0.1:<浣犵殑绔彛>/dsh-usage-dashboard/snapshot
```

杩斿洖 `{"ok":true,...}` 鍗?Host 鍗婂凡灏辩华銆傞娆℃墦寮€浼氭壂鎻忓叏閮ㄤ細璇濇棩蹇楋紝閫氬父涓€涓ょ锛涗箣鍚庤蛋 revision 缂撳瓨锛屽彧鏈夊彉鍔ㄧ殑浼氳瘽浼氶噸璇伙紙瀹炴祴鍐疯绾?800ms锛岀儹璇荤害 25ms锛夈€?
## 閰嶇疆

浠锋牸琛ㄥ湪 `cordis.patch.yml` 閲岋紝瀹夎鍚庝篃鍙湪鎻掍欢绠＄悊椤典慨鏀癸細

```yaml
- insert:
    - id: dsh-usage-dashboard
      name: dsh-usage-dashboard
      config:
        historyDays: 182      # 鏃ュ簭鍒椾笌鐑姏鍥剧獥鍙ｏ紙鎶樼嚎鍥句粠涓垏鐗囷級
        maxSessions: 600      # 鏈€澶氭壂鎻忔渶杩?N 涓細璇?        pricing:
          currency: CNY
          unit: 1000000       # 鍗曚环鎸夈€屾瘡 N 涓?token銆嶈
          default: { miss: 2, hit: 0.2, write: 2, output: 3 }
          models:
            deepseek-v4.1-flash: { miss: 2, hit: 0.2, write: 2, output: 3 }
            deepseek-v4-pro: { miss: 4, hit: 1, write: 4, output: 12 }
```

- 妯″瀷閿厛鎸?**瀹屽叏鍖归厤**锛屽啀鎸?**鏈€闀垮墠缂€** 鍖归厤锛坄deepseek-v4-pro` 涔熻鐩?`deepseek-v4-pro-2026`锛夛紝閮戒笉涓殑钀藉埌 `default`
- 璐圭敤鍏紡锛歚(miss 脳 杈撳叆 + hit 脳 缂撳瓨鍛戒腑 + write 脳 缂撳瓨鍐欏叆 + output 脳 杈撳嚭) / unit`

> 鈿狅笍 鍐呯疆鍗曚环鏄?*浼扮畻鐨勮捣鐐?*锛屼笉鏄处鍗曘€傛敼鎴愪綘瀹為檯浠樿垂鐨勪环鏍笺€傜湅鏉块〉鑴氬缁堟樉绀哄綋鍓嶇敓鏁堢殑甯佺涓庡崟浣嶃€?
### 璁¤垂鍙ｅ緞

浼氳瘽鏃ュ織閲岀殑 `TokenUsage` 閬靛惊 Anthropic Messages 璇箟锛圖eepSeek 璺敱璧扮殑灏辨槸杩欏鍗忚锛夛細

- `inputTokens` 鏄?*鏈懡涓紦瀛?*鐨勮緭鍏?- `cacheReadTokens` / `cacheWriteTokens` 鏄?*鐙珛璁℃暟**锛屼笉鏄?`inputTokens` 鐨勫瓙闆?- `prompt = input + cacheRead + cacheWrite`锛宍tokens = prompt + output`

## 宸ヤ綔鍘熺悊

鍏ㄩ儴鏁板瓧閮戒粠浼氳瘽鏃ュ織鎺ㄥ锛屾彃浠舵湰韬笉鎸佹湁浜嬪疄鏉ユ簮锛?
```
assistant/message 鈹€鈹攢 data.usage        鈫?鍥涚被 token 璁℃暟
                   鈹斺攢 data.message.source 鈫?provider + model
```

- Host 鍗婇€氳繃 `sessionPersistence` 璇诲彇鏃ュ織锛屾寜 `SessionPersistenceSnapshot.revision` 鍋氬閲忕紦瀛橈紙缂撳瓨鎸傚湪 `Symbol.for` 鍏ㄥ眬涓婏紝HMR 閲嶆寕杞戒笉浼氶噸鏂板叏閲忔壂鎻忥級
- 鍙涓€涓矾鐢憋細`GET /dsh-usage-dashboard/snapshot[?refresh=1]`锛宍no-store`
- 瀹㈡埛绔彧璐熻矗娓叉煋锛屾瘡 60 绉掓媺涓€娆″揩鐓э紝鎵嬪姩鍒锋柊浼氬悓鏃堕噸璇昏处鎴蜂綑棰?
## 鍗歌浇

```
plugin_manager action=remove_bundle target=dsh-usage-dashboard
```

## 宸茬煡闄愬埗

- 鍙粺璁℃湰杩涚▼ `sessionPersistence.list()` 鑳界湅鍒颁笖娌℃湁琚?`maxSessions` 鎴柇鐨勪細璇?- 浣欓闇€瑕佸涓绘寕杞?`deepseekAccount`锛涙病鏈夋椂浼氭樉绀恒€屾湭鍚敤銆嶈€屼笉鏄け璐?- 浼氳瘽鏃ュ織鑻ヨ鍏朵粬宸ュ叿褰掓。绉昏蛋锛屼笉浼氳鍏?
## 璁稿彲

MIT
