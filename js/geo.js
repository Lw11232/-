/* ══════════════════════════════════════════════════════════════
   geo.js — IP 定位：跟随访客所在城市显示
   多源降级：ipinfo.io → ipwho.is → ipapi.co → 兜底

   ⚠ 隐私约束：只输出「城市名」，绝不显示 / 渲染任何 IP 地址。
   IP 仅在内存中用于查询，绝不写入 DOM。
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // 需要同步更新的城市显示位（仅左下角常驻：跟随访客所在城市）
  // 注：联系面板内的「城市」为作者固定信息（广州），不随访客定位变化，故不入此列表
  var cityEls = [
    document.getElementById('locCity')
  ].filter(function (el) { return !!el; });

  if (!cityEls.length) return;

  var SOURCES = [
    {
      url: 'https://ipinfo.io/json',
      parse: function (d) {
        return { city: d.city, region: d.region, country: d.country };
      }
    },
    {
      url: 'https://ipwho.is/',
      parse: function (d) {
        return { city: d.city, region: d.region, country: d.country_code };
      }
    },
    {
      url: 'https://api.ipapi.co/json/',
      parse: function (d) {
        return { city: d.city, region: d.region, country: d.country_code };
      }
    }
  ];

  /* 中国省份 → 中文名映射（常见项，避免整表过大） */
  var CN_PROVINCE = {
    beijing: '北京', shanghai: '上海', guangzhou: '广州', shenzhen: '深圳',
    tianjin: '天津', chongqing: '重庆', hangzhou: '杭州', nanjing: '南京',
    suzhou: '苏州', chengdu: '成都', wuhan: '武汉', xian: '西安',
    qingdao: '青岛', dalian: '大连', xiamen: '厦门', ningbo: '宁波',
    changsha: '长沙', zhengzhou: '郑州', jinan: '济南', hefei: '合肥',
    fuzhou: '福州', kunming: '昆明', dongguan: '东莞',
    foshan: '佛山', harbin: '哈尔滨', changchun: '长春', shenyang: '沈阳',
    'hong kong': '香港', macau: '澳门', taipei: '台北',
    // 直辖市 / 省会 / 计划单列市补充
    shijiazhuang: '石家庄', taiyuan: '太原',
    wenzhou: '温州', nanchang: '南昌', guiyang: '贵阳', nanning: '南宁',
    lanzhou: '兰州', urumqi: '乌鲁木齐', haikou: '海口', sanya: '三亚',
    lhasa: '拉萨', xining: '西宁', yinchuan: '银川', hohhot: '呼和浩特',
    yantai: '烟台', weifang: '潍坊', quanzhou: '泉州',
    zhanjiang: '湛江', zhongshan: '中山', huizhou: '惠州', jiangmen: '江门',
    yueyang: '岳阳', changde: '常德', yichang: '宜昌',
    jingzhou: '荆州', xiangyang: '襄阳', luoyang: '洛阳', kaifeng: '开封',
    xuzhou: '徐州', nantong: '南通', yangzhou: '扬州', taizhou: '台州',
    jinhua: '金华', ningde: '宁德', longyan: '龙岩', sanming: '三明',
    nanping: '南平', putian: '莆田', zhangzhou: '漳州', mianyang: '绵阳',
    danyang: '丹阳', zhenjiang: '镇江', jiangyin: '江阴', yixing: '宜兴',
    changshu: '常熟', zhangjiagang: '张家港', kunshan: '昆山',
    wujiang: '吴江', tongxiang: '桐乡', haining: '海宁', pinghu: '平湖',
    yiwu: '义乌', dongyang: '东阳', zhuji: '诸暨',
    shengzhou: '嵊州', langxi: '兰溪', yuyao: '余姚', cixi: '慈溪',
    wenling: '温岭', linhai: '临海', yuhuan: '玉环'
  };

  /* 省份英文名 → 中文（ipwho.is 返回 "Guangdong Sheng" 这类格式） */
  var CN_REGION = {
    'beijing': '北京', 'shanghai': '上海', 'guangdong': '广东',
    'guangdong sheng': '广东', 'zhejiang': '浙江', 'zhejiang sheng': '浙江',
    'jiangsu': '江苏', 'jiangsu sheng': '江苏', 'shandong': '山东',
    'shandong sheng': '山东', 'henan': '河南', 'henan sheng': '河南',
    'sichuan': '四川', 'sichuan sheng': '四川', 'hubei': '湖北',
    'hubei sheng': '湖北', 'hunan': '湖南', 'hunan sheng': '湖南',
    'hebei': '河北', 'hebei sheng': '河北', 'fujian': '福建',
    'fujian sheng': '福建', 'anhui': '安徽', 'anhui sheng': '安徽',
    'shaanxi': '陕西', 'shanxi': '山西', 'liaoning': '辽宁',
    'heilongjiang': '黑龙江', 'jilin': '吉林', 'chongqing': '重庆',
    'tianjin': '天津', 'yunnan': '云南', 'guizhou': '贵州',
    'guangxi': '广西', 'gansu': '甘肃', 'xinjiang': '新疆',
    'neimenggu': '内蒙古', 'ningxia': '宁夏', 'qinghai': '青海',
    'xizang': '西藏', 'hainan': '海南', 'jiangxi': '江西'
  };

  var COUNTRY_CN = {
    CN: '中国', US: '美国', JP: '日本', KR: '韩国', GB: '英国',
    FR: '法国', DE: '德国', IT: '意大利', ES: '西班牙', CA: '加拿大',
    AU: '澳大利亚', SG: '新加坡', RU: '俄罗斯', TH: '泰国', MY: '马来西亚'
  };

  function normalize(v) {
    if (!v) return '';
    return String(v).trim();
  }

  function formatPlace(info) {
    var country = COUNTRY_CN[normalize(info.country).toUpperCase()] || info.country || '';
    var city = normalize(info.city);
    var region = normalize(info.region);

    // 中国：优先显示中文城市名（纯中文，无英文后缀）
    if (country === '中国') {
      var cnCity = CN_PROVINCE[city.toLowerCase()];
      if (cnCity) return cnCity;
      // 城市名不在映射表：如果是中文原名直接用
      if (/[一-龥]/.test(city)) return city;
      // 回退到省份中文名
      var cnRegion = CN_REGION[region.toLowerCase()];
      if (cnRegion) return cnRegion;
      return city || region || '中国';
    }

    // 国外：优先城市名
    if (city) return city;
    return region || country || '未知';
  }

  function apply(info) {
    if (!info) return false;
    var place = formatPlace(info);
    if (!place || place === '未知') return false;
    // 只写城市名 —— 隐私约束：DOM 中不出现任何 IP
    cityEls.forEach(function (el) { el.textContent = place; });
    return true;
  }

  function fail() {
    cityEls.forEach(function (el) { el.textContent = '位置未知'; });
  }

  /* 依次尝试各数据源 */
  var idx = 0;
  function next() {
    if (idx >= SOURCES.length) { fail(); return; }
    var s = SOURCES[idx++];
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);

    fetch(s.url, ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        if (apply(s.parse(d))) return;   // 成功即止
        next();
      })
      .catch(function () { clearTimeout(timer); next(); });
  }

  next();
})();