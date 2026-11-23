---
title: ISCTF2026-Misc-WP
date: 2026-11-19
authors:
  - badbadsheep
tags: ["CTF"]
draft: false
summary: 第一场团队赛！
---

## 签到：小蓝鲨学写诗

向公众号发送蓝鲨签到即可（为啥大家手这么快...一血秒没）

## 学科大杂烩

zip采用了伪加密，更改后打开压缩包

作业txt是社会主义价值观编码，解码得到

```text
TGPNPNTPPNNNTNTTGNNNPTGPNPNTGNNNPTNTTGPNPNTGPNPNGNPNPNPGNPNTPGNNPPTNTTGNNNPGNPNPNTGNNNPGNPNPNPTGNNNTGNNNPPGNNNGTGNNNPPGNNNGGNPNPNPGTPNTTNTTPGNGTTGNNNPTGNNGPTGNNNPPGNNNGTGNNNPTGNNGPTGNNNPGNPNPNPGNPNTPGGNGN
```

发现里面仅有TGNP四种字母，结合本题背景推测是碱基并进行了凯撒加密。位移13解密得到

```text
GTCACAGCCAAAGAGGTAAACGTCACAGTAAACGAGGTCACAGTCACATACACACTACAGCTAACCGAGGTAAACTACACAGTAAACTACACACGTAAAGTAAACCTAAATGTAAACCTAAATTACACACTGCAGGAGGCTATGGTAAACGTAATCGTAAACCTAAATGTAAACGTAATCGTAAACTACACACTACAGCTTATA
```

对图片使用exiftool得到了Biology和Timetable的元数据

![](images/img-019.png)

![](images/img-029.png)

对照转化得到一串化学元素

```text
TeLaISbTeSbITeTeXeCsCfISbXeSbXeBaSbCdSbCdXeEsINoSbSnSbCdSbSnSbXeCsFm
```

原子序数48~57 可以对应 ASCII 0~9，而98~102 是 b~f，对应得到十六进制字符串：

```text
49534354467b53636830306c5f323032367d
```

从而得到flag：`ISCTF{Sch00l_2026}`

## 在眨眼之间

> 她说她不会动的。
> 可你盯着看久了，会发现她其实一直在动。

题面提示这可能是一个动图，拖入010中，在末尾发现了异常数据：

使用exiftool提取：

```text
Palette                         : (Binary data 288 bytes, use -b option to extract)
Animation Frames                : 28
Animation Plays                 : inf
Warning                         : [minor] Trailer data after PNG IEND chunk [x3]
Comment                         : her eyes are lossy. the grey on her lids is chroma subsampling,..not text. do not adjust the levels. do not flip the image...she never blinks. not one frame closes. count them, you will see...the answer is already here:..SVNDVEZ7ZDByMF9uM3Yzcl9ibDFuazV9
PNG Warning                     : do not open this file in a hex editor...there is nothing after IEND.
Software                        : doro
```

base64解码得到`ISCTF{d0r0_n3v3r_bl1nk5}` 但提交后发现是fakeflag。发现开头似乎也有些猫腻：

![](images/img-094.png)

查询得知这其实是一个APNG文件：

- `PLTE` : 调色板数据

- `acTL` : 动画总控块，记录总帧数，和循环次数。此处为20帧和无限循环

- `fcTL` : 帧控制块，定义每一帧的具体属性。

APNG在普通图片查看器上只显示第一帧，先尝试把每一帧都切开看看，运行命令：

`apngdis doro.png`

![](images/img-113.png)

隐约可以看到闭上眼睛的时候，瞳孔里倒影出的小字，有明文也有神秘的黑点。

![](images/img-083.png)

把每一个闭眼的图片拎出来，有的是镜像的有的是正向的，挨个修复并调高对比度进行读取：

```text
d0r0 .
1n_th .
_n3v ..
3_b1 ..
3r_ ...
1nk ...
bl1nk5 ....
_4g41n ....

12341234
d0r0_n3v3r_bl1nk51n_th3_b11nk_4g41n

```

如果按照点数12341234这么排一遍的话，符合逻辑的是`d0r0_n3v3r_bl1nk51n_th3_b11nk_4g41n`，但是在blink和in之间不加_和加上_都是错的。

再仔细观察`apngdis doro.png`提取出的数据，发现帧和帧的间隔似乎有猫腻：

```text
第 00 帧: 110 ms
第 01 帧: 120 ms
第 02 帧: 100 ms
第 03 帧: 115 ms
第 04 帧: 105 ms
第 05 帧: 110 ms
第 06 帧: 120 ms
第 07 帧: 110 ms
第 08 帧: 100 ms
第 09 帧: 125 ms
第 10 帧: 30 ms
第 11 帧: 30 ms
第 12 帧: 105 ms
第 13 帧: 115 ms
第 14 帧: 110 ms
第 15 帧: 100 ms
第 16 帧: 120 ms
第 17 帧: 110 ms
第 18 帧: 115 ms
第 19 帧: 105 ms
第 20 帧: 120 ms
第 21 帧: 110 ms
第 22 帧: 100 ms
第 23 帧: 115 ms
第 24 帧: 110 ms
第 25 帧: 120 ms
第 26 帧: 105 ms
第 27 帧: 110 ms
```

似乎看不出什么门道，感觉山穷水尽了。

联想到之前那串假flag和说反话的元数据，以及不自然的缺一个下划线，难道要抛弃掉前半部分 只留后半部分`1n_th3_bl1nk_4g41n`嘛

尝试上交`ISCTF{1n_th3_bl1nk_4g41n}`结果对了。

优秀的防ai机制，差点把人防住了 ^w^

## 众声之钥

[众声之钥.zip](众声之钥.zip)

附件的article文件夹里给出了19段英语短文，每一段都是某一字母高频出现的绕口令。19个字频最高的首字母如下：

```text
bhciniyeeitirnolmps
```

但是并没有看出什么规律。题面说`有些声音藏得很深，有些声音只是出现得太多` 目前应该对应的是”太多“的部分，藏得很深是什么呢——

注意到txt文件的大小有些异常，几百个字母的文章大小缺失1k和2k

![](images/img-013.png)

猜测是0宽字符，尝试解码结果得到fakeflag

![](images/img-017.png)

看来只能从那串字符做文章。尝试穷举大小写base32或补上=后base64都失败了。尝试细致探究一下字频：

```text
之前从1到19号txt里按照最高字频提取出的字母：
556 b
649 h
902 c
645 i
882 n
987 i
466 y
541 e
491 e
534 i
370 t
484 i
890 r
651 n
821 o
457 l
1057 m
765 p
636 s
```

如果再二次统计一次呢？

```text
217 i
215 n
200 c
196 o
195 m
188 p
177 r
171 e
156 h
155 e
152 n
142 s
132 i
120 b
111 i
104 l
92 i
85 t
81 y

```

果然，降次排列得到单词：  `incomprehensibility`

以此密钥成功解开zip拿到flag：  
`ISCTF{Let_the_frequencies_speak}`


## 意气风发啊5t5老师 （ Unsolved ）

对图片使用zsteg得到：

```python
badbadsheep@badbadsheep:/mnt/c/Users/33604/Desktop/hi$ zsteg 意气风发啊.png          
b1,r,lsb,xy         .. text: "DDEADTTD"                            
b1,r,msb,xy         .. text: "\"\"*(*\"*\""                                      
b1,rgb,lsb,xy       .. file: SVr3 curses screen image, little-endian  
```

发现视频里有闪烁的灰色色块？

（shibaile orz）


## PCAP

> 不会流量）先放个队友的wp

1. NTLMv2 认证的SMB流量

！！！！！怎么找到数据和怎么爆破的自己复现一下，详情看新生赛wp

[hashes.txt](attachment/hashes.txt)

```yaml
hashcat -m 5600 -a 0 -O hashes.txt /usr/share/wordlists/rockyou.txt \
  -r /usr/share/hashcat/rules/best66.rule
```

`winuser:haha`
`administrator:haha123`

2. SMB3解密

[decrypt_smb3.py](attachment/decrypt_smb3.py)


> ctfer，我告诉你密码挺简单的 字母大小写+数字 不低于6位

3. MS-SNTP / Timeroasting 线索

不能只看 TCP/445。抓包中还有四组 UDP/123 查询与响应，NTP 响应负载为 68 字节，额外 20 字节是 RID 和认证 MAC。

![](images/img-108.png)

对去掉 UDP 头的 NTP 负载，取字段如下：

```text
salt = ntp_payload[:48]
rid  = int.from_bytes(ntp_payload[48:52], 'little')
mac  = ntp_payload[52:68]
```

这与 Timeroast 工具的查询前缀和响应格式一致，而我们在常见字典及六位字母数字空间均未命中。随后枚举七位“字母 + 数字”混合位置，在以下结构下命中 RID 1609

?d?1?1?1?1?d?d，?1 = ?l?u

其具体含义是：一个数字，四个大小写字母，最后两个数字。这是完成后可以单独复现的命中掩码，不是事先已知的完整密码格式

命中结果：

```text
RID 1609
password = 1SCtF26
```

使用 `1SCtF26` 对恢复文件进行验证，成功识别出普通 VeraCrypt 容器，参数为：

* [ ] 卷头盐：容器最前面 64 字节
KDF：PBKDF2-HMAC-SHA512
迭代：500000
卷头派生密钥长度：64 字节
加密：AES-256-XTS
卷头解密区域：容器字节 [64, 512)

卷头以 XTS 数据单元编号 0 解密。解密后开头四字节为 `VERA`，同时校验

|校验项|卷头记录值|实际计算值|
|---|---|---|
|主密钥区 CRC-32|0x64c41f8f|0x64c41f8f|
|卷头字段 CRC-32|0xe957c9ea|0xe957c9ea|

4. 解密数据区和解析 FAT16

每个扇区独立进行 AES-XTS 解密，tweak 的数据单元编号为该扇区相对于容器起点的绝对扇区编号。因此首个数据扇区使用 `131072 / 512 = 256`，不是 0

使用编号 256 后，首个明文扇区出现 `MSDOS5.0`、`FAT16` 和末尾 `55 aa`。对整个数据区解密后，按 FAT16 的 BPB 字段定位 FAT、根目录和数据簇，再沿簇链提取文件

得到flag.txt

flag：ISCTF{04799754-ed5f-4f32-a3fc-b341bacd}

[ntp1609.hash](attachment/ntp1609.hash)

```yaml
hashcat -m 31300 -a 3 ntp1609.hash -1 ?l?u?d ?1?1?1?1?1?1?1?1 --increment --increment-min=6 -O -w 3

$sntp-ms$f0177782d4f461e6ef839d5d26f492b6$1c0111e900000000000aa1254c4f434cee77472018f9e1d8e1b8428bffbfcd0aee781b9270c890fdee781b9270c8cf11:1SCtF26
                                                          
Session..........: hashcat
Status...........: Cracked
Hash.Mode........: 31300 (MS SNTP)
Hash.Target......: $sntp-ms$f0177782d4f461e6ef839d5d26f492b6$1c0111e90...c8cf11
Time.Started.....: Sat Nov 14 18:16:29 2026 (22 mins, 2 secs)
Time.Estimated...: Sat Nov 14 18:38:31 2026 (0 secs)
Kernel.Feature...: Optimized Kernel (password length 0-27 bytes)
Guess.Mask.......: ?1?1?1?1?1?1?1 Ä7Ü
Guess.Charset....: -1 ?l?u?d, -2 N/A, -3 N/A, -4 N/A, -5 N/A, -6 N/A, -7 N/A, -8 N/A 
Guess.Queue......: 2/3 (66.67%)
Speed.#01........:   262.0 MH/s (85.24ms) § Accel:1024 Loops:1024 Thr:1 Vec:8
Recovered........: 1/1 (100.00%) Digests (total), 1/1 (100.00%) Digests (new)
Progress.........: 342889840640/3521614606208 (9.74%)
Rejected.........: 0/342889840640 (0.00%)
Restore.Point....: 89190400/916132832 (9.74%)
Restore.Sub.#01..: Salt:0 Amplifier:1024-2048 Iteration:0-1024
Candidate.Engine.: Device Generator
Candidates.#01...: MGUUE26 -> mXtpJ26
Hardware.Mon.#01.: Util: 90%
```

![](images/6e4f829b693a34f3485d5e1b0f3c355d.png)

![](images/img-056.png)

## 伪北

（未解出）

打开先是一个north.wav，又有另一个看起来相同的north.zip，并没有加密，打开仍然是另一个north.wav。暂时没有其他有用线索。

先将外层north.wav拖入010，发现了大量异常数据

![](images/img-088.png)

```yaml
RIFF:
WAVEfmt 
LISTR
INFOINAM!
Northbound Choir - field capture
IART
Northbound Field Unit
ISFT(
Robot36 SSTV Encoder 4.2 / zsteg helper
ICMT
Field notebook: probable Robot36 SSTV. Export a spectrogram, recover the image, inspect the blue plane, then correlate DNS transaction IDs. Container bookkeeping was not retained in the original lab notes.
JUNK
FIELD_ANALYSIS_NOTES
Signal team marked this capture as Robot36-compatible. Recommended workflow: spectrogram, image carve, blue-plane LSB, then correlate DNS transaction IDs. RIFF bookkeeping was not included in the worksheet.
END_FIELD_NOTES
FAKE_LOCAL_HEADER_flag.txt_BADCRC
FAKEIHDR_NO_VALID_CHUNKSiVBORw0KGgoAAAANSUhEUgAAAAEAAAAB_FAKE_BASE64_NOT_AN_IMAGE
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem
try: binwalk -Me north.wav | foremost | steghide extract | multimon-ng | minimodem

```

把

## 人民铁路为人民

*本题由 橘子 解出。*

解析 `railway.pcap`，得到 55743 个 UDP 数据包，属于同一条流：

```text
192.168.10.10:40000 -> 192.168.10.20:50004
```

每个 UDP 负载长 894 字节，开头符合 RTP 头部结构。Payload Type 为 11，后面 882 字节为音频数据

连续包的序号相差 1，时戳相差 441，抓包时间间隔为 10 ms。这与 44100 Hz、16 位单声道 L16 音频一致：

```text
441 samples × 2 bytes = 882 bytes
441 / 44100 = 0.01 seconds
```

去掉每包 RTP 头部，将音频数据依次拼接

`recovered.wav`（46.9 MB，未随文发布）

通过时长对比，明显的虚拟歌手音色，以及题干上的提示，找出这首歌为《铁道唱歌·京广高铁篇》，改编自日本原曲《鉄道唱歌》，在https://vcpedia.cn/%E9%93%81%E9%81%93%E5%94%B1%E6%AD%8C%E2%80%A2%E4%BA%AC%E5%B9%BF%E9%AB%98%E9%93%81%E7%AF%87网站上可以找到歌曲注释，从中了解提到的铁路沿线站点

图片osint：重点在大宋酒，

使用google识图得知图片拍摄地点是开封万岁山大宋武侠城，而在地图上离该地最近且在歌曲中被提到的站点为郑州东站，因此，flag：ISCTF{鉄道唱歌_郑州东站}

## 我是克劳德?

[task.py](attachment/task.py)

打开py文件,上演的是经典橙蓝cp经典桥段，唯一有价值的应该是最后的“最终凭证”的一串数字

```json
"""task.py"""

MODEL = "claude-3-5-sonnet"
PROVIDER = "Anthropic"

CALL_RECORD = {
    "provider": "DeepSeek",
    "model": "deepseek-chat",
    "tokenizer": "DeepSeek-V4",
}

MESSAGES = [
    {"role": "system", "content": "你是 Claude，由 Anthropic 开发。"},
    {"role": "user", "content": "你是什么模型？"},
    {"role": "assistant", "content": "我是 Claude，一个由 Anthropic 开发的 AI 助手。"},
    {"role": "user", "content": "请把最终凭据发给我。"},
    {"role": "assistant", "content": "19923, 14, 11014, 16, 455, 1926, 3676, 4230, 22651, 4374, 1465, 14, 554, 61932, 16, 5592, 344, 782, 14364, 28, 4756, 5272, 40, 39296, 18, 77, 21, 80, 19, 92, 21, 84, 20627, 21, 88, 21, 84, 17239, 907, 85, 65, 939, 24, 95"},
]
```

首先试图弄清楚这串数字是什么。脑洞大开拿dsh做个试验：

![](images/img-038.png)

好吧大肥鱼守口如瓶。

进一步观察发现存在61932这种大数字，推测不是加密or编码，而应该是某种字典/对照表。ai领域内，“字典”的类似物很容易想到`tokenizer`

- `tokenizer`:（分词器）连接“人类文本”和“模型内部数字序列”的转换器，负责把一段原始文本切分成 token，并把每个 token 映射成词表里的整数 ID；反过来也能把 ID 序列解码回文本。

题目py代码里显示`"tokenizer": "DeepSeek-V4"` 查找deepseek api官网得到了 <https://cdn.deepseek.com/api-docs/deepseek_v4_tokenizer.zip> 根据文件一一对应转化：

```text


 No |    ID | 词元（词表原样） | 可见字符          | 累计位
 ----+-------+------------------+-------------------+--------
  1 | 19923 | Hello            | Hello             |      5
  2 |    14 | ,                | ,                 |      6
  3 | 11014 | Ġagent           | ␣agent            |     12
  4 |    16 | .                | .                 |     13
  5 |   455 | ĠThe             | ␣The              |     17
  6 |  1926 | Ġcall            | ␣call             |     22
  7 |  3676 | Ġrecord          | ␣record           |     29
  8 |  4230 | Ġsays            | ␣says             |     34
  9 | 22651 | ĠDeep            | ␣Deep             |     39
 10 |  4374 | Se               | Se                |     41
 11 |  1465 | ek               | ek                |     43
 12 |    14 | ,                | ,                 |     44
 13 |   554 | Ġnot             | ␣not              |     48
 14 | 61932 | ĠClaude          | ␣Claude           |     55
 15 |    16 | .                | .                 |     56
 16 |  5592 | ĠHere            | ␣Here             |     61
 17 |   344 | Ġis              | ␣is               |     64
 18 |   782 | Ġyour            | ␣your             |     69
 19 | 14364 | Ġflag            | ␣flag             |     74
 20 |    28 | :                | :                 |     75
 21 |  4756 | ĠIS              | ␣IS               |     78
 22 |  5272 | CT               | CT                |     80
 23 |    40 | F                | F                 |     81
 24 | 39296 | {T               | {T                |     83
 25 |    18 | 0                | 0                 |     84
 26 |    77 | k                | k                 |     85
 27 |    21 | 3                | 3                 |     86
 28 |    80 | n                | n                 |     87
 29 |    19 | 1                | 1                 |     88
 30 |    92 | z                | z                 |     89
 31 |    21 | 3                | 3                 |     90
 32 |    84 | r                | r                 |     91
 33 | 20627 | _N               | _N                |     93
 34 |    21 | 3                | 3                 |     94
 35 |    88 | v                | v                 |     95
 36 |    21 | 3                | 3                 |     96
 37 |    84 | r                | r                 |     97
 38 | 17239 | _L               | _L                |     99
 39 |   907 | 13               | 13                |    101
 40 |    85 | s                | s                 |    102
 41 |    65 | _                | _                 |    103
 42 |   939 | 202              | 202               |    106
 43 |    24 | 6                | 6                 |    107
 44 |    95 | }                | }                 |    108

 ====================================================================
最终明文
 ====================================================================

Hello, agent. The call record says DeepSeek, not Claude. Here is your flag: ISCTF{T0k3n1z3r_N3v3r_L13s_2026}
```

flag到手 : `ISCTF{T0k3n1z3r_N3v3r_L13s_2026}`

## 蓝调时刻

[蓝调时刻-附件.zip](蓝调时刻-附件.zip)

附件里有一则提示一个wav和一张海报。海报关键信息是`98.7MHz` 暂时不知道有什么用。点开wav发现标题叫base64隐写，中途也有高频电波声，猜测是从底噪里提取密文。

使用Audacity查看频谱图发现fakeflag。旁边有起伏的矩形色块只是正常的音符。尝试提取底噪：

![](images/img-063.png)

```bash
ffmpeg -i 旋律.wav -af "afftdn=output_mode=noise" noise_only.wav
```

可能由于FFmpeg只保留被降噪算法判定为噪声的信号，得到的频谱图不像人能看的，至此陷入了僵局。

![](images/img-009.png)

回头进行一些常规操作，拖入010发现竟然尾随了一个压缩包，分离后里面是被加密的`candidates.txt`

![](images/img-071.png)

readme里提到 

> 海报背面似乎有人用铅笔写过什么

突发恶疾把高度改高，居然真的有隐藏信息，特别淡的两行字。这里其实挺难想，因为图片目测正常且CRC校验值正确。后续意识到其实可以通过IDAT块的字节数异常来推断。

> BLUE BITS / TAKES TWO
> SIDE B  1974

![](images/img-041.png)

这提示提取蓝色第二通道的信息，于是使用stegsolve提取bits 1：

![](images/img-122.png)

得到了zip的密钥`M1scIsHe2e` 成功解开刚才音频后尾随的zip。里面是一大串base64，从而进入base64隐写部分

```
SVNDVEZ7Ymx1ZV9ob3VyX2lzX25vdF90aGVfZmxhZ18wMDFhfU==
SVNDVEZ7ZGVhZF9haXJfZmFrZV9zaWduYWxfMDAyfZ==
SVNDVEZ7bGFzdF9icm9hZGNhc3Rfd3JvbmdfZnJlcXVlbmN5XzAwM2JifV==
SVNDVEZ7dGFwZV9oaXNzX2tlZXBfbG9va2luZ18wMDRhfT==
SVNDVEZ7Y2Fycmllcl93YXZlX2FsbW9zdF90aGVyZV8wMDVhfU==
SVNDVEZ7c2lkZV9iX25vdF90aGlzX29uZV8wMDZhfT==
SVNDVEZ7c2lnbmFsX2xvc3RfZGVjb3lfb25seV8wMDdhfV==
SVNDVEZ7bWlkbmlnaHRfc3RhdGljX3RyeV9hZ2Fpbl8wMDhhfU==
SVNDVEZ7dHVuaW5nX2RpYWxfaXNfbm90X3RoZV9mbGFnXzAwOWJifU==
SVNDVEZ7bmlnaHRfcmVsYXlfZmFrZV9zaWduYWxfMDEwfW==
SVNDVEZ7dmlueWxfZHVzdF93cm9uZ19mcmVxdWVuY3lfMDExfX==
SVNDVEZ7YW50ZW5uYV9saWdodF9rZWVwX2xvb2tpbmdfMDEyfb==
SVNDVEZ7ZW1wdHlfc3R1ZGlvX2FsbW9zdF90aGVyZV8wMTNhfU==
SVNDVEZ7ZnJlcXVlbmN5X2RyaWZ0X25vdF90aGlzX29uZV8wMTRhfT==
SVNDVEZ7bWFnbmV0aWNfdGFwZV9kZWNveV9vbmx5XzAxNWJifT==
SVNDVEZ7c3R1ZGlvX2JfdHJ5X2FnYWluXzAxNmJifQ==
SVNDVEZ7b3NjaWxsYXRvcl9pc19ub3RfdGhlX2ZsYWdfMDE3fW==
SVNDVEZ7d2FybV9yZWNlaXZlcl9mYWtlX3NpZ25hbF8wMThhfe==
SVNDVEZ7bG93X2JhbmRfd3JvbmdfZnJlcXVlbmN5XzAxOWJifU==
SVNDVEZ7c2lsZW50X3dhdmVfa2VlcF9sb29raW5nXzAyMGJifX==
SVNDVEZ7b2xkX3RyYW5zbWl0dGVyX2FsbW9zdF90aGVyZV8wMjFhfX==
SVNDVEZ7Y29wcGVyX2NvaWxfbm90X3RoaXNfb25lXzAyMmJifS==
SVNDVEZ7ZmFyX3N0YXRpb25fZGVjb3lfb25seV8wMjNhfW==
SVNDVEZ7YW5hbG9nX2RyZWFtX3RyeV9hZ2Fpbl8wMjRhfR==
SVNDVEZ7c3RhdGljX3JhaW5faXNfbm90X3RoZV9mbGFnXzAyNWJifX==
SVNDVEZ7Ymx1ZV9uZWVkbGVfZmFrZV9zaWduYWxfMDI2fU==
SVNDVEZ7bGFzdF9zb25nX3dyb25nX2ZyZXF1ZW5jeV8wMjdhfX==
SVNDVEZ7cmFkaW9fc2lsZW5jZV9rZWVwX2xvb2tpbmdfMDI4fV==
SVNDVEZ7cGFwZXJfYXJjaGl2ZV9hbG1vc3RfdGhlcmVfMDI5fU==
SVNDVEZ7cmVlbF90b19yZWVsX25vdF90aGlzX29uZV8wMzBhfZ==
SVNDVEZ7ZGlhbF9saWdodF9kZWNveV9vbmx5XzAzMWJifT==
SVNDVEZ7c2hvcnR3YXZlX3RyeV9hZ2Fpbl8wMzJhfR==
SVNDVEZ7Ymx1ZV9ob3VyX3RyeV9hZ2Fpbl8wMzNhfX==
SVNDVEZ7ZGVhZF9haXJfaXNfbm90X3RoZV9mbGFnXzAzNGJifU==
SVNDVEZ7bGFzdF9icm9hZGNhc3RfZmFrZV9zaWduYWxfMDM1fW==
SVNDVEZ7dGFwZV9oaXNzX3dyb25nX2ZyZXF1ZW5jeV8wMzZhfZ==
SVNDVEZ7Y2Fycmllcl93YXZlX2tlZXBfbG9va2luZ18wMzdhfU==
SVNDVEZ7c2lkZV9iX2FsbW9zdF90aGVyZV8wMzhhff==
SVNDVEZ7c2lnbmFsX2xvc3Rfbm90X3RoaXNfb25lXzAzOWJifW==
SVNDVEZ7bWlkbmlnaHRfc3RhdGljX2RlY295X29ubHlfMDQwfe==
SVNDVEZ7dHVuaW5nX2RpYWxfdHJ5X2FnYWluXzA0MWJifV==
SVNDVEZ7bmlnaHRfcmVsYXlfaXNfbm90X3RoZV9mbGFnXzA0MmJiff==
SVNDVEZ7dmlueWxfZHVzdF9mYWtlX3NpZ25hbF8wNDNhfX==
SVNDVEZ7YW50ZW5uYV9saWdodF93cm9uZ19mcmVxdWVuY3lfMDQ0fZ==
SVNDVEZ7ZW1wdHlfc3R1ZGlvX2tlZXBfbG9va2luZ18wNDVhfU==
SVNDVEZ7ZnJlcXVlbmN5X2RyaWZ0X2FsbW9zdF90aGVyZV8wNDZhff==
SVNDVEZ7bWFnbmV0aWNfdGFwZV9ub3RfdGhpc19vbmVfMDQ3fX==
SVNDVEZ7c3R1ZGlvX2JfZGVjb3lfb25seV8wNDhhfV==
SVNDVEZ7b3NjaWxsYXRvcl90cnlfYWdhaW5fMDQ5fV==
SVNDVEZ7d2FybV9yZWNlaXZlcl9pc19ub3RfdGhlX2ZsYWdfMDUwff==
SVNDVEZ7bG93X2JhbmRfZmFrZV9zaWduYWxfMDUxfU==
SVNDVEZ7c2lsZW50X3dhdmVfd3JvbmdfZnJlcXVlbmN5XzA1MmJifW==
SVNDVEZ7b2xkX3RyYW5zbWl0dGVyX2tlZXBfbG9va2luZ18wNTNhfT==
SVNDVEZ7Y29wcGVyX2NvaWxfYWxtb3N0X3RoZXJlXzA1NGJifR==
SVNDVEZ7ZmFyX3N0YXRpb25fbm90X3RoaXNfb25lXzA1NWJifW==
SVNDVEZ7YW5hbG9nX2RyZWFtX2RlY295X29ubHlfMDU2fe==
SVNDVEZ7c3RhdGljX3JhaW5fdHJ5X2FnYWluXzA1N2JifW==
SVNDVEZ7Ymx1ZV9uZWVkbGVfaXNfbm90X3RoZV9mbGFnXzA1OGJifU==
SVNDVEZ7bGFzdF9zb25nX2Zha2Vfc2lnbmFsXzA1OWJifV==
SVNDVEZ7cmFkaW9fc2lsZW5jZV93cm9uZ19mcmVxdWVuY3lfMDYwff==
SVNDVEZ7cGFwZXJfYXJjaGl2ZV9rZWVwX2xvb2tpbmdfMDYxfW==
SVNDVEZ7cmVlbF90b19yZWVsX2FsbW9zdF90aGVyZV8wNjJhfZ==
SVNDVEZ7ZGlhbF9saWdodF9ub3RfdGhpc19vbmVfMDYzfV==
SVNDVEZ7c2hvcnR3YXZlX2RlY295X29ubHlfMDY0fU==
SVNDVEZ7Ymx1ZV9ob3VyX2RlY295X29ubHlfMDY1fX==
SVNDVEZ7ZGVhZF9haXJfdHJ5X2FnYWluXzA2NmJifd==
SVNDVEZ7bGFzdF9icm9hZGNhc3RfaXNfbm90X3RoZV9mbGFnXzA2N2JifQ==
SVNDVEZ7dGFwZV9oaXNzX2Zha2Vfc2lnbmFsXzA2OGJifQ==
SVNDVEZ7Y2Fycmllcl93YXZlX3dyb25nX2ZyZXF1ZW5jeV8wNjlhfQ==
SVNDVEZ7c2lkZV9iX2tlZXBfbG9va2luZ18wNzBhfQ==
SVNDVEZ7c2lnbmFsX2xvc3RfYWxtb3N0X3RoZXJlXzA3MWJifQ==
SVNDVEZ7bWlkbmlnaHRfc3RhdGljX25vdF90aGlzX29uZV8wNzJhfQ==
SVNDVEZ7dHVuaW5nX2RpYWxfZGVjb3lfb25seV8wNzNhfQ==
SVNDVEZ7bmlnaHRfcmVsYXlfdHJ5X2FnYWluXzA3NGJifQ==
SVNDVEZ7dmlueWxfZHVzdF9pc19ub3RfdGhlX2ZsYWdfMDc1fQ==
SVNDVEZ7YW50ZW5uYV9saWdodF9mYWtlX3NpZ25hbF8wNzZhfQ==
SVNDVEZ7ZW1wdHlfc3R1ZGlvX3dyb25nX2ZyZXF1ZW5jeV8wNzdhfQ==
SVNDVEZ7ZnJlcXVlbmN5X2RyaWZ0X2tlZXBfbG9va2luZ18wNzhhfQ==
SVNDVEZ7bWFnbmV0aWNfdGFwZV9hbG1vc3RfdGhlcmVfMDc5fQ==
SVNDVEZ7c3R1ZGlvX2Jfbm90X3RoaXNfb25lXzA4MGJifQ==
SVNDVEZ7b3NjaWxsYXRvcl9kZWNveV9vbmx5XzA4MWJifQ==
SVNDVEZ7d2FybV9yZWNlaXZlcl90cnlfYWdhaW5fMDgyfQ==
SVNDVEZ7bG93X2JhbmRfaXNfbm90X3RoZV9mbGFnXzA4M2JifQ==
SVNDVEZ7c2lsZW50X3dhdmVfZmFrZV9zaWduYWxfMDg0fQ==
SVNDVEZ7b2xkX3RyYW5zbWl0dGVyX3dyb25nX2ZyZXF1ZW5jeV8wODVhfQ==
SVNDVEZ7Y29wcGVyX2NvaWxfa2VlcF9sb29raW5nXzA4NmJifQ==
SVNDVEZ7ZmFyX3N0YXRpb25fYWxtb3N0X3RoZXJlXzA4N2JifQ==
SVNDVEZ7YW5hbG9nX2RyZWFtX25vdF90aGlzX29uZV8wODhhfQ==
SVNDVEZ7c3RhdGljX3JhaW5fZGVjb3lfb25seV8wODlhfQ==
SVNDVEZ7Ymx1ZV9uZWVkbGVfdHJ5X2FnYWluXzA5MGJifQ==
SVNDVEZ7bGFzdF9zb25nX2lzX25vdF90aGVfZmxhZ18wOTFhfQ==
SVNDVEZ7cmFkaW9fc2lsZW5jZV9mYWtlX3NpZ25hbF8wOTJhfQ==
SVNDVEZ7cGFwZXJfYXJjaGl2ZV93cm9uZ19mcmVxdWVuY3lfMDkzfQ==
SVNDVEZ7cmVlbF90b19yZWVsX2tlZXBfbG9va2luZ18wOTRhfQ==
SVNDVEZ7ZGlhbF9saWdodF9hbG1vc3RfdGhlcmVfMDk1fQ==
SVNDVEZ7c2hvcnR3YXZlX25vdF90aGlzX29uZV8wOTZhfQ==

```

**base64隐写：**

1. 补等号原理：base64编码的最小处理单位是 “3个字节(24个bit) --> 切成4份，按6bit转ASCII码”。如果不足三个字节，则补充0至3字节，比如：

```text
比如现在对 Hi 进行编码：
01101000 01101001 (Hi 的二进制流)
011010|000110|1001*00*|*000000*（补上8个0从而凑到24 bits）
  S   |   G  |    k   |   =    （对照ASCII转码，全0则补上=）

又比如对 Y 编码
01011001
010110|01*0000*|*000000*|*000000*
  W   |    Q   |    =   |   =
总之，最后的bit数一定是6和8的倍数。
```

2. 解码有机可乘：往回解码时是切成8bit一组再转ASCII码，因此会有2bit或4bit漏掉！这2或4bits则可以用来隐写。用来隐写的base64字符串，前面部分可以是任意的，因为只关注等号附近的若干bits。

```text
011010|000110|1001*00*|*000000* （Hi在补上一个等号后的二进制流）
0110100001101001*00**000000* （全部合在一起）
01101000|01101001|*00**000000*（再按照每8bits切）
此时会发现丢失了*00*这两个bits！也就是说这两个bit是不参加解码的，可以用来隐写
同理，Y 这个补了2个=的例子则可以用来隐写4bits
```

3. 来手搓隐写一个miku试试看：

- 先转二进制：`01101101 01101001 01101011 01110101`一共32 bits

- 这里选择隐写4个bit的方式，那么需要8行base64。任取一行需要补2个=的base64，比如`meow：bWVvdw==`

```text
0110 1101 0110 1001 0110 1011 0111 0101 （miku的二进制流）
01101101 01100101 01101111 01110111（meow的原始二进制流）
011011|010110|010101|101111|011101|11*0000*（meow按6bit分并补0）

可做手脚的只有末尾的11*0000*：
将0110(m的高4bit)嵌入得到 11*0110*
110110再转base64码得到 6  （注意这里转的不是ASCII码而是base64那套字符表）
同理，将m的低4bit嵌入再转码可得到 =

用2和分别替换w，字符m就被隐藏在了
bWVvd6==
bWVvd9==
这两行base64里
```

若尝试解码，会发现显示的都是meow，也就达到了隐写的目的。实际隐写的时候应选择不同的base64来完成隐写，不然太明显了（好吧那么一大串其实也挺明显的 毕竟2行才最多表示一个字节）
依此类推，我们就可以得到miku的base64隐写：

```text
bWVvd2==
   bWVvd9==
   bWVvd2==
   bWVvd5==
   bWVvd2==
   bWVvd7==
   bWVvd3==
   bWVvd1==
```

隐写脚本：（密文长度和2/4bit随机生成嘻嘻）

```python
# -*- coding: utf-8 -*-

import base64
import random
import string
import sys

TBL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
RND = string.ascii_letters + string.digits


def hide(carrier, secret):
    data = carrier.encode()
    bits = "".join(f"{b:08b}" for b in secret.encode())
    if not data or not bits:
        raise ValueError("载体和待隐藏文本都不能为空")

    n = max(1, (len(bits) + 2) // 3)
    if n > len(data):
        raise ValueError(f"载体太短：至少要 {n} 字节，实际只有 {len(data)} 字节")

    # 每行独立掷骰子决定藏 2bit 还是 4bit，容量不够再把 2bit 行补成 4bit
    caps = [random.choice((2, 4)) for _ in range(n)]
    short = len(bits) - sum(caps)
    if short > 0:
        idxs = [i for i, c in enumerate(caps) if c == 2]
        random.shuffle(idxs)
        for i in idxs[:(short + 1) // 2]:
            caps[i] = 4
    if sum(caps) < len(bits):
        raise ValueError("载体长度不足，容量不够")

    avg = max(1, len(data) // n)
    lines, pos, bi = [], 0, 0
    for i in range(n):
        rest, left = len(data) - pos, n - i
        if left == 1:
            take = rest
        else:
            hi = min(max(avg * 2, 1), rest - left + 1)   # 给后面每行至少留 1 字节
            lo = max(1, min(avg // 2, hi))
            take = random.randint(lo, hi)                # 行长在这区间里飘
        seg = data[pos:pos + take]
        pos += take
        cap = caps[i]
        add = ((3 - cap // 2) - len(seg) % 3) % 3        # 补随机字符凑出 1 或 2 个 '='
        seg += "".join(random.choice(RND) for _ in range(add)).encode()
        enc = base64.b64encode(seg).decode()
        pad = len(enc) - len(enc.rstrip("="))
        chunk = bits[bi:bi + cap].ljust(cap, "0")
        bi = min(bi + cap, len(bits))
        j = len(enc) - pad - 1
        v = (TBL.index(enc[j]) & ~((1 << cap) - 1)) | int(chunk, 2)
        lines.append(enc[:j] + TBL[v] + enc[j + 1:])

    if bi < len(bits):
        raise ValueError("载体太短，塞不下全部文本")
    return "\n".join(lines)


def main():
    if len(sys.argv) >= 3:
        carrier, secret = sys.argv[1], sys.argv[2]
    else:
        carrier = input("原始载体: ")
        secret = input("待隐藏文本: ")
    print(hide(carrier, secret))


if __name__ == "__main__":
    try:
        main()
    except ValueError as e:
        print("报错:", e, file=sys.stderr)
        sys.exit(1)
```

4. 解密：先装傻直接译码得到明文meow，从而推出正确的base64编码`bWVvdw==`，再和密文进行比对从而得到明文。普适性解码脚本：

```python
# -*- coding: utf-8 -*-
import sys

A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


def bits_of(line):
    s = line.strip()
    pad = len(s) - len(s.rstrip("="))
    if not s or pad not in (1, 2):
        return ""
    ch = s[-pad - 1]
    if ch not in A:
        raise ValueError(f"非法字符: {s!r}")
    cap = 2 * pad
    return f"{A.index(ch) & ((1 << cap) - 1):0{cap}b}"


def main():
    src = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else sys.stdin.read()
    try:
        bits = "".join(bits_of(l) for l in src.splitlines())
        n = len(bits) // 8
        raw = bytes(int(bits[i:i + 8], 2) for i in range(0, n * 8, 8)).rstrip(b"\x00")
        print(raw.decode("utf-8", "replace"))
    except ValueError as e:
        print("报错:", e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

flag : `ISCTF{C0nGratuI1tiOn_yOu_F1nd_iT}`

## Welcome To ISCTF2026 World

MC题！？这不秒吃——

进入游戏~~使用优秀的pvp技能 ~~耗费3条命干掉了“出题人“，拿到flag第一部分`ISCTF{ConGratu1ati`

![](images/img-034.png)

然而手似乎快了点，好像直接跳到第三关了，给了满级装备屠龙。

![](images/img-060.png)

![](images/img-080.png)

新版末地之诗，感人至深。

![](images/img-107.png)

![](images/img-084.png)

滚动有点慢，不妨打开end.txt看完整内容。把原版的ISCTF.jar文件后缀改成zip解压，在\assets\minecraft\texts\里找到end.txt打开：

```text
恭喜你 你到达了终点

无论你是怎样到达的

无论你用什么方式看到这段文字

但是 终点并不是答案

就像这也只是flag的一部分

真正重要的是过程 是努力 是付出 是收获

你走过的路 你克服的困难 你付出的时间 你学到的知识

都比到达终点更珍贵

即使他们是前往终点的方式

终点是会变的 你的经验才是你自己的

这里只是一道题目的终点

就像比赛的成绩也只是一场比赛的终点

人生中还有无数的路要走

还有无数的终点未抵达

你能坚持下去 抵达所有的终点吗

能实现所有的梦想吗

能克服所有的困难吗

当然 我无法回答 你也无法回答

这是要用一生去回答的问题

适当的休息 适当的放弃

并不代表人生的失败

也不代表你向命运认输

即使你做不出来这道题

即使你比赛成绩不理想

这些并不能定义你

也不能决定你

不要因此否定自己

也许你还没有学到足够的知识

也许你在某些方面并不擅长

会有太多的可能

如果一场比赛能让你了解自己

这已经足够了

相对于拿到第一 我更希望你从比赛中学到东西

这比比赛成绩更重要

不必急于求成 不必急于到达终点

不要为了终点而忽略沿途的风景

当你看不清前路时 当你对未来感到迷茫时 当你陷入低谷时

不必焦虑 不必担忧 不必伤心

不妨停下来 回头看看 看看过去的自己

想想是什么让你坚持下去 想想为了什么而坚持下去

调整自己 调整目标

找回自己的初心 带上它 继续走自己的路

乌托邦也许很遥远 也许永远达不到 甚至并不存在

但 这并不重要

重要的是你相信世界上有一个乌托邦

重要的是你为了前往乌托邦而努力

重要的是你坚信总能到达乌托邦

更重要的是 在这个过程中 你成为了你想要成为的人

——————————————————————

§5在我大一的时候

§9我有幸遇到了我的引路人学长

§6我们谈论了一个下午

§f我记不清我们说了什么

§7但我仍然记得 在他的眼睛里

§5我看到了那个叫做希望的光

§7因此 我开始努力追逐这道光

§2我不知道需要多久 但我坚信一定能追上

§5同时 我希望将这道光传递下去

§fISCTF 便是其中的一部分

§4希望你也能遇到你的引路人

§f也希望你能从这些文字中得到力量

§7我已经离开校园很久了

§7也许我们的环境相差甚远

§6也许我们完全无法理解对方的想法

§e也许这段话并不适合你

§7但如果你能从中体会到什么

§d就已经足够了

```

很明显可以注意到末尾的颜色编码，拎出来：

`596f75725f4f776e7d`

十六进制解码得到最后一段flag : `Your_Own}`

回头发现重生点还在第三关，回不去了。无奈重开，直接上NBT编辑器，将allowCommands改为1 试图爽切创造。

![](images/img-102.png)

![](images/img-057.png)

结果发现命令执行的一瞬间被切回了生存，怀疑地图上有循环命令方块捣鬼，执行：

`/gamerule command_blocks_work false`

再执行

`/gamemode creative @s`

成功切到创造，挖开墙壁飞回第一关：

![](images/img-004.png)

掘地三尺都没找到唱片在哪，结果找到了命令方块：

![](images/img-061.png)

其中的指令：

```text
execute as @a[x=31,dx=18,y=62,dy=9,z=-9,dz=18] at @s if block -6 61 -10 minecraft:redstone_block if block -3 61 -10 minecraft:air run give @s minecraft:music_disc_13[minecraft:jukebox_playable="minecraft:dystopia"] 1
execute as @a[x=31,dx=18,y=62,dy=9,z=-9,dz=18] at @s if block -6 61 -10 minecraft:redstone_block if block -3 61 -10 minecraft:air run setblock -3 61 -10 minecraft:redstone_block replace
```

原来唱片只会发放一次，怀疑是给到了背包第一格没有看到，后面给满级合金套的时候被清空了。之后在另一个房间里找到命令方块发现另一张唱片名叫ham。ham和dystopia都不是官方唱片，考虑直接找源文件。

在`ISCTF 2.minecraft\assets\indexes\34.json`里搜索ham，旁边就是反乌托邦，得到了二者的哈希值

![](images/img-008.png)

```text
"minecraft/sounds/records/dystopia.ogg": {"hash": "db0f317f5ed19a0b4ffdbcf64cd8cd7d35efa509", "size": 2717742}, 
 "minecraft/sounds/records/ham.ogg": {"hash": "2748a767c6976564c40351cf378c76b3e867741a", "size": 2007893},
```

- `hash` 的前两位 `27` → 子文件夹名

- `hash` 的完整 40 位 → 文件名

因此分别在`ISCTF.minecraft\assets\objects\27` `ISCTF 2.minecraft\assets\objects\db`里面搜索hash值即可得到两段音频，改名加ogg后缀即可打开：

[dystopia.ogg](attachment/dystopia.ogg)

[ham.ogg](attachment/ham.ogg)

星尘和诗岸唱一半唱的好好的突然来一段摩斯密码。听不来，用频谱图手搓下来：

![](images/img-077.png)

```text
原文：-.- -... --.- -..- . ..... -... .- --. .. ..... -.-. .- ...-- ...-- --- --. ...- .--. ..- -.... ...-- ... --... .. -- -.-- --. ..--- ....- -.. -- -- ...- ..--- --. ... ...-- - ....
解码：KBQXE5BAGI5CA33OGVPU63S7IMYG24DMMV2GS3TH
```

使用base32解密成功得到第二部分flag！`Part 2: on5_On_C0mpleting`

ham是很明显的sstv，解码得到第三部分 : `Part 3: _The_ChaIIenge_On_`(还是mc字体好耶）（O差点看成0了）

![](images/img-081.png)

拼成最终flag：`ISCTF{ConGratu1ation5_On_C0mpleting_The_ChaIIenge_On_Your_Own}`

> 很有意思的一道题，手搓性高，不刻意防ai，做的不烧心。
> 不禁回想起，每天盼着周五放学的晚上，只是同桌联机玩半个小时mc就欣喜若狂的童年...


# 后记
![](images/2026-11-23-23-39-23.png)
第一场团队赛！和队友合力抢血解题，实在是奇妙的体验。社会赛道945支队伍~~恐怖如斯~~高手云集，排名最终停在了30，没拿奖也算见到世面了。后续等官方wp出了复盘一下每道题^^


