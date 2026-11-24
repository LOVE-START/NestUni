Page({
  data: {
    texts: [
      "有时候啊，我们在世界上走得太快了",
      "快到连回头看一眼自己都来不及",
      "不知道从什么时候开始",
      "我们不太敢说出自己的喜欢、不喜欢",
      "害怕被误解，也害怕没人回应",
      "于是就慢慢地安静下来",
      "但其实，心里有好多好多想说的话",
      "有很多的爱好 有很多想做的事",
      "更多的是在孤单的夜里的",
      "一点点想要分享的心情",
      "还有那些，不知该说给谁听的故事",
      "南苑Nest便在这样的契机下诞生了",
      "它不是一个热闹的广场",
      "更像是一片柔软的巢",
      "你可以在这里停一会儿",
      "来寻找自己的热爱",
      "来遇到自己的知己",
      "来发现生活的更多可能",
      "也可以静静地看看别人",
      "写下的绚丽青春色彩",
      "希望这里能成为你的'角落'",
      "一个能被世界轻轻接住的地方",
      "不论你是快乐、失落、迷茫还是期待",
      "我们永远会在这里",
      "有灯光 也有回应",
      "有故事 也有朋友",
      "我们都在一起",
      "学着生活，学着相遇",
      "而能与你在这里相遇",
      "依旧是我最温柔的幸运",
      "嗨",
      "欢迎回家",
      "❤️"
    ],
    currentIndex: 0,
    currentText: '',
    displayText: '',
    fadeOut: false,
    showFinal: false,
    showFinalImage: false,
    finalTexts: [],
    finalDisplayTexts: ['', '', '', '', ''],
    currentFinalLine: 0,
    finalCharIndex: 0,
    timer: null,
    charTimer: null,
    finalCharTimer: null,
    imageTimer: null,
    charIndex: 0,
    activeTab: 'manual',
    manualSections: [
      {
        title: '🌟 欢迎来到南苑 Nest',
        content: '南苑 Nest 是一个温暖的校园社区，在这里你可以发现有趣的社团、参与丰富的活动，也能遇见和你同频的人。让我们一起用热爱的光，照耀整个校园。'
      },
      {
        title: '🍊 首页 · 发现社团',
        content: '首页是社团的入口，也是探索的起点：\n• 查看公告弹窗，第一时间获取最新通知\n• 使用搜索框快速找到感兴趣的社团\n• 按分类筛选：艺术 / 公益 / 体育 / 文化 / 学术\n• 浏览社团卡片，了解成员规模和招新状态\n• 点击卡片进入详情页深入了解\n• 下拉刷新，获取最新内容'
      },
      {
        title: '🍇 社团详情 · 靠近一点点',
        content: '点击社团卡片，慢慢了解这个社团的样子：\n• 滑动浏览社团封面与相册\n• 查看成员数、活动数、公告数\n• 阅读社团介绍，了解氛围与方向\n• 浏览社团发布的活动与公告\n• 点击「招新」报名加入\n• 查看并参与社团活动'
      },
      {
        title: '🍑 招新报名 · 加入你的热爱',
        content: '遇见喜欢的社团，就别犹豫啦：\n• 填写基础信息：姓名 / 性别 / 年级 / 专业\n• 填写联系方式\n• 写一段简单的自我介绍\n• 提交后等待社团审核\n• 可在「我的报名」中查看进度'
      },
      {
        title: '🍉 活动广场 · 捕捉精彩',
        content: '这里汇聚了校园里的所有热闹：\n• 搜索活动名称或地点\n• 分类浏览：学术 / 文艺 / 文化 / 娱乐等\n• 查看活动状态：报名中 / 进行中 / 已结束\n• 一键报名参与活动\n• 点击卡片查看详细信息'
      },
      {
        title: '🍒 活动详情 · 更近一步参与',
        content: '在这里，你可以更完整地了解一场活动：\n• 查看封面、时间、地点等关键信息\n• 点击地点，一键进入地图导航\n• 阅读活动介绍和图片内容\n• 查看报名截止时间和联系方式\n• 报名参加或取消报名\n• 在评论区交流互动\n• 了解活动标签与参与要求'
      },
      {
        title: '🍋 活动地图 · 一键找到现场',
        content: '不再迷路的小功能：\n• 在活动详情页点击地点\n• 自动跳转地图页面\n• 查看活动具体位置\n• 支持查看与定位'
      },
      {
        title: '🥝 个人中心 · 你的专属角落',
        content: '一个有点特别的小空间：\n• 左右滑动切换三张票卡\n• 第一张：个人身份卡（昵称 / 学号）\n• 第二张：我的社团与活动\n• 第三张：我的报名记录\n• 点击头像或徽章登录\n• 下拉刷新同步最新数据\n所有卡片都可以自定义封面哦'
      },
      {
        title: '🫐 登录说明',
        content: '解锁完整体验，需要登录哦：\n• 点击头像或徽章进行登录\n• 授权获取基础信息\n• 可填写学号、微信号（选填）\n• 设置你的昵称与头像\n• 登录后可参与活动、加入社团\n• 所有记录都会保存在个人中心'
      },
      {
        title: '🍎 反馈与建议',
        content: '你的想法，对我们很重要：\n• 在个人中心点击「Opinion | 感受」\n• 或进入「About | 关于」页面\n• 可复制开发者微信：Zero__Night\n• 或发送邮件至：candy_night@163.com'
      },
      {
        title: '❤️ 温馨提示',
        content: '愿你在南苑 Nest 里，找到热爱、遇见伙伴，也可以绽放出属于自己的光。\n\n最后感谢所有加入 Nest 的大家，我们共同完成了这个伟大而浪漫的奇迹。\n\n谢谢你们 \n\nThanks for everyone ❤️'
      }
    ]
  },

  onLoad() {
    const textsLength = this.data.texts.length;
    const finalTexts = [
      this.data.texts[textsLength - 5],
      this.data.texts[textsLength - 4],
      this.data.texts[textsLength - 3],
      this.data.texts[textsLength - 2],
      this.data.texts[textsLength - 1]
    ];
    
    this.setData({
      finalTexts: finalTexts
    });
  },

  /**
   * 切换显示内容
   * @param {Object} e - 事件对象
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    
    if (tab === 'story') {
      this.clearAllTimers();
      this.setData({
        activeTab: tab,
        currentIndex: 0,
        currentText: '',
        displayText: '',
        fadeOut: false,
        showFinal: false,
        showFinalImage: false,
        finalDisplayTexts: ['', '', '', '', ''],
        currentFinalLine: 0,
        finalCharIndex: 0,
        charIndex: 0
      });
      this.showNextText();
    } else {
      this.clearAllTimers();
      this.setData({
        activeTab: tab
      });
    }
  },

  showNextText() {
    if (this.data.activeTab !== 'story') return;
    
    if (this.data.currentIndex >= this.data.texts.length - 5) {
      this.showFinalTexts();
      return;
    }

    const currentText = this.data.texts[this.data.currentIndex];
    
    this.setData({
      currentText: currentText,
      displayText: '',
      charIndex: 0,
      fadeOut: false
    });
    
    this.displayTextByChar();
  },
  
  displayTextByChar() {
    if (this.data.activeTab !== 'story') return;
    
    const { currentText, charIndex } = this.data;
    
    if (charIndex <= currentText.length) {
      const displayText = currentText.substring(0, charIndex);
      
      this.setData({
        displayText: displayText,
        charIndex: charIndex + 1
      });
      
      this.data.charTimer = setTimeout(() => {
        this.displayTextByChar();
      }, 100);
    } else {
      this.data.timer = setTimeout(() => {
        this.fadeOutCurrentText();
      }, 1500);
    }
  },
  
  fadeOutCurrentText() {
    this.setData({
      fadeOut: true
    });
    
    setTimeout(() => {
      this.setData({
        currentIndex: this.data.currentIndex + 1
      });
      this.showNextText();
    }, 1000);
  },

  showFinalTexts() {
    this.clearAllTimers();
    
    this.setData({
      currentText: '',
      displayText: '',
      fadeOut: false,
      showFinal: true,
      currentFinalLine: 0,
      finalCharIndex: 0,
      finalDisplayTexts: ['', '', '', '', '']
    });
    
    setTimeout(() => {
      this.displayFinalTextByChar();
    }, 800);
  },
  
  displayFinalTextByChar() {
    if (this.data.activeTab !== 'story') return;
    
    const { finalTexts, currentFinalLine, finalCharIndex } = this.data;
    const currentFinalText = finalTexts[currentFinalLine];
    
    if (finalCharIndex <= currentFinalText.length) {
      const newFinalDisplayTexts = [...this.data.finalDisplayTexts];
      newFinalDisplayTexts[currentFinalLine] = currentFinalText.substring(0, finalCharIndex);
      
      this.setData({
        finalDisplayTexts: newFinalDisplayTexts,
        finalCharIndex: finalCharIndex + 1
      });
      
      this.data.finalCharTimer = setTimeout(() => {
        this.displayFinalTextByChar();
      }, 120);
    } else {
      if (currentFinalLine < 4) {
        setTimeout(() => {
          this.setData({
            currentFinalLine: currentFinalLine + 1,
            finalCharIndex: 0
          });
          this.displayFinalTextByChar();
        }, 1200);
      } else {
        this.data.imageTimer = setTimeout(() => {
          this.setData({
            showFinalImage: true
          });
        }, 2000);
      }
    }
  },

  goBack() {
    wx.navigateBack();
  },

  clearAllTimers() {
    if (this.data.timer) {
      clearTimeout(this.data.timer);
      this.data.timer = null;
    }
    if (this.data.charTimer) {
      clearTimeout(this.data.charTimer);
      this.data.charTimer = null;
    }
    if (this.data.finalCharTimer) {
      clearTimeout(this.data.finalCharTimer);
      this.data.finalCharTimer = null;
    }
    if (this.data.imageTimer) {
      clearTimeout(this.data.imageTimer);
      this.data.imageTimer = null;
    }
  },

  onHide() {
    this.clearAllTimers();
  },
  
  onUnload() {
    this.clearAllTimers();
  }
})
