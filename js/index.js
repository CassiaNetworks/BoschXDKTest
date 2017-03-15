$(function () {
    let globalData = {
        hubIp: '',
        xdkData: {},
        isConnecting: false,
        rate: 64000000,
        timer: null,
        chip: 0
    }
    $('#start').on('click', function () {
        globalData.hubIp = $('#hubIp').val()
        startTest(hubIp)
    })
    $('#scanChange').on('click', function () {
        if (this.innerHTML === 'open') {
            this.innerHTML = 'close'
            api.scan.close()
        } else if (this.innerHTML === 'close') {
            this.innerHTML = 'open'
            api.scan()
        }
    })
    $('#setRate').on('change', function () {
        $('#rate').html(this.value)
        let fre = Math.floor(1000 / this.value).toString(16)
        globalData.rate = lsbToMsb(fre, 4)
    })


    function lsbToMsb(string, totalbyte) {
        let length = string.length,
            _string = string,
            n = 1,
            str = _string
        if (length % 2) {
            _string = '0' + _string
            length++
        }
        if (parseInt(_string, 16) > 256) {
            str = ''
            while (length - 2 * n >= 0) {
                str += _string.substr(length - 2 * n, 2)
                n++
            }
        }
        while (str.length < totalbyte * 2) {
            str = str + '00'
        }
        return str
    }

    function startTest(hubIp) {
        $('#scanChange').html('open')
        api.use({
            server: globalData.hubIp,
            hub: ''
        })
        api.on('notify', dataHandle)
            .scan(0)
            .on('scan', scanHandle)
    }

    function dataHandle(hub, data) {
        if (data !== 'keep-alive') {
            let _data = JSON.parse(data),
                WlanMAC = _data.value.slice(0, 12),
                num = parseInt(_data.value.slice(12, 14), 16) + 1,
                mac = _data.id
            if (!globalData.xdkData[mac])
                return

            globalData.xdkData[mac].WlanMAC = WlanMAC



            // console.log(WlanMAC, num)
            countHandle(mac, WlanMAC, num)
        }
    }

    function scanHandle(hub, data) {
        if (data == 'keep-alive')
            return
        let _data = JSON.parse(data),
            type = _data.bdaddrs[0].bdaddrType,
            mac = _data.bdaddrs[0].bdaddr,
            name = _data.name
        if (name === 'XDK_BLE_I40' && !globalData.isConnecting) {
            globalData.isConnecting = true
            api.conn({
                node: mac,
                type,
                chip: chipChange()
            }).done(setRate(mac, 25, globalData.rate)).always(() => globalData.isConnecting = false)
        }
    }

    function chipChange() {
        if (globalData.chip === 0) {
            globalData.chip = 1
        } else {
            globalData.chip = 0
        }
        return globalData.chip
    }

    function BaseData() {

        Object.defineProperties(data, {
            WlanMAC: {
                value: 0,
                set: item => this.WlanMAC = item,
                get: item => this.WlanMAC
            }
        })

    }

    function setRate(mac, hadle, value) {

        if (!globalData.xdkData[mac]) {
            globalData.xdkData[mac] = {
                WlanMAC: '',
                loop: -1,
                theory: 0,
                reality: 0,
                rete: 0,
                lastNum: 0,
                runTime: -1
            }
            connectRender('pending', mac)
        }
        setTimeout(function () {
            return api.write({
                node: mac,
                handle: hadle,
                value: value
            })
        }, 1000)
    }

    function countHandle(mac, WlanMAC, num) {
        let item = globalData.xdkData[mac],
            lastNum = item.lastNum
        if (num === 1 && lastNum === 0) {
            lastNum = 1
        }
        if (lastNum === 0) {
            return
        }
        if (globalData.xdkData[mac].runTime === -1) {
            globalData.xdkData[mac].runTime = 0

        }
        if (!globalData.timer) {
            globalData.timer = setInterval(function () {
                for (let key in globalData.xdkData) {
                    if (globalData.xdkData[key] && globalData.xdkData[key].runTime !== -1) {
                        globalData.xdkData[key].runTime++
                    }
                }
            }, 1000)
        }
        if (num > lastNum) {
            item.reality++
        } else if (num <= lastNum) {
            item.loop++
                item.reality++
        }

        item.lastNum = num
        item.theory = 255 * item.loop + num
        item.rate = ((1 - item.reality / (255 * item.loop + num)) * 100).toFixed(5)
        dataUiRender(mac)
    }

    function connectRender(WlanMAC, BluetoothMAC) {
        $('#xdkItem ul').append(createLiString(WlanMAC, BluetoothMAC))
        let $liItem = $('#xdkItem ul').find(`li[data-BluetoothMAC='${BluetoothMAC}']`),
            $allP = $liItem.find('p')
        globalData.xdkData[BluetoothMAC].selectedEle = {
            WlanMAC: $allP.eq(0).find('span'),
            BluetoothMAC: $allP.eq(1).find('span'),
            runTime: $allP.eq(2).find('time'),
            theory: $allP.eq(3).find('span'),
            reality: $allP.eq(4).find('span'),
            lost: $allP.eq(5).find('span'),
            rate: $allP.eq(6).find('b')
        }
    }

    function createLiString(WlanMAC, BluetoothMAC) {
        let string = `<li data-BluetoothMAC=${BluetoothMAC}>
                <p>WlanMAC:<span>${WlanMAC}</span></p>
                <p>BluetoothMAC:<span>${BluetoothMAC}</span></p>
                <p>运行时间:
                    <time></time>S
                </p>
                <p>应该收到的蓝牙包:<span></span>个</p>
                <p>实际收到的蓝牙包:<span></span>个</p>
                <p>丢失蓝牙包:<span></span>个</p>
                <p>丢包率:<b></b>%</p>
            </li>`
        return string
    }

    function dataUiRender(BluetoothMAC) {
        let selectedEle = globalData.xdkData[BluetoothMAC].selectedEle
        for (let key in selectedEle) {
            if (typeof globalData.xdkData[BluetoothMAC][key])
                selectedEle[key].html(globalData.xdkData[BluetoothMAC][key])
        }
        selectedEle.lost.html(globalData.xdkData[BluetoothMAC].theory - globalData.xdkData[BluetoothMAC].reality)
    }





})