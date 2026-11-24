/**
 * 公告弹窗组件
 * @description 显示公告信息，支持版本检测、图片显示和倒计时关闭功能
 */

const { themeManager } = require('../../utils/theme.js');
const { updateAnnouncementVersion } = require('../../utils/cacheConfig.js');

Component({
	properties: {
		show: {
			type: Boolean,
			value: false,
			observer: function(newVal) {
				if (newVal) {
					// 每次显示时刷新主题，确保弹窗跟随当前首页主题色
					this.setData({ theme: themeManager.getTheme() });
					this.startCountdown();
				} else {
					this.clearCountdown();
				}
			}
		},
		title: {
			type: String,
			value: '公告通知'
		},
		content: {
			type: String,
			value: ''
		},
		image: {
			type: String,
			value: ''
		},
		announcementVersion: {
			type: Number,
			value: 0
		}
	},

	data: {
		visible: false,
		countdown: 5,
		// 初始即取当前主题，避免首帧渲染时渐变变量为空
		theme: themeManager.getTheme()
	},

	lifetimes: {
		detached() {
			this.clearCountdown();
		}
	},

	methods: {
		/**
		 * 开始5秒倒计时
		 * @description 倒计时期间按钮不可点击，配合进度环动画显示
		 */
		startCountdown() {
			this.setData({
				visible: true,
				countdown: 5
			});

			this._countdownTimer = setInterval(() => {
				const newCountdown = this.data.countdown - 1;
				if (newCountdown <= 0) {
					this.clearCountdown();
					this.setData({ countdown: 0 });
				} else {
					this.setData({ countdown: newCountdown });
				}
			}, 1000);
		},

		/**
		 * 清除倒计时定时器
		 */
		clearCountdown() {
			if (this._countdownTimer) {
				clearInterval(this._countdownTimer);
				this._countdownTimer = null;
			}
		},

		/**
		 * 点击遮罩层事件
		 * @description 倒计时期间不可关闭，显示友好提示；倒计时结束后可关闭但不写入缓存
		 */
		onMaskTap() {
			if (this.data.countdown > 0) {
				wx.showToast({
					title: '请阅读公告内容',
					icon: 'none',
					duration: 1500
				});
				return;
			}

			// 倒计时结束后，允许关闭弹窗但不写入缓存
			this.clearCountdown();
			
			// 先隐藏弹窗，触发退出动画
			this.setData({
				visible: false,
				countdown: 5
			});

			// 延迟触发关闭事件，让动画有时间播放
			// 注意：不调用 updateAnnouncementVersion，下次还会显示
			setTimeout(() => {
				this.triggerEvent('close');
			}, 300);
		},

		/**
		 * 图片预览
		 * @description 点击图片放大预览
		 */
		onImagePreview() {
			const image = this.properties.image;
			if (image) {
				wx.previewImage({
					current: image,
					urls: [image]
				});
			}
		},

		/**
		 * 确认按钮点击事件
		 * @description 点击后缓存公告版本并关闭弹窗，添加关闭动画
		 */
		onConfirm() {
			if (this.data.countdown > 0) {
				return;
			}

			const announcementVersion = this.properties.announcementVersion;
			
			// 使用 cacheConfig 中的函数更新公告版本缓存
			updateAnnouncementVersion(announcementVersion);

			this.clearCountdown();
			
			// 先隐藏弹窗，触发退出动画
			this.setData({
				visible: false,
				countdown: 5
			});

			// 延迟触发确认事件，让动画有时间播放
			setTimeout(() => {
				this.triggerEvent('confirm');
			}, 300);
		}
	}
});
