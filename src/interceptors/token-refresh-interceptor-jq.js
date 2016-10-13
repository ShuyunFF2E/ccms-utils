/**
 * Created by Sadalsuud on 2016/10/11.
 */
import { getRequestCredential, setRequestCredential, removeRequestCredential } from '../credentials';

export function setAuthFailedBehavior(fn = execAuthFailure) {
	execAuthFailure = () => {
		try {
			fn();
		} finally {
			removeRequestCredential();
		}
		const ex = new TypeError('credential was expired or had been removed, pls set it before the get action!');
		console.error(ex);
		$.Deferred().reject(ex);
	};
}


const Date = window.Date;
const $ = window.$;

const REQUEST_TOKEN_HEADER = 'X-TOKEN';
const USER_SESSION_AVAILABLE_TIME = 30 * 60 * 1000;
const REQUEST_WHITE_LIST = [];

let needToRefreshToken = false;
let execAuthFailure = () => {
};
let refreshTokenUrl = '';

export default {
	beforeSend: function(xhr) {
		const credential = getRequestCredential();
		if (!credential) {
			execAuthFailure();
			return;
		}

		xhr.setRequestHeader(REQUEST_TOKEN_HEADER, credential.id);
		if (credential.refreshToken && REQUEST_WHITE_LIST.indexOf(this.url) === -1) {

			const expireTime = Date.parse(credential.expireTime);
			const now = Date.now();

			// token失效则直接跳转登录页面
			// token未失效但是可用时长已低于用户会话最短保留时间,则需要刷新token
			if (USER_SESSION_AVAILABLE_TIME >= expireTime - now && expireTime - now >= 0) {
				needToRefreshToken = true;
			} else if (expireTime - now < 0) { // token失效
				return execAuthFailure();
			}
		}
	},
	complete: function() {
		// 如果请求能正常响应,说明 storage 里的状态是存在的,所以这里不做判断
		const credential = getRequestCredential();

		// 所有请求结束了才做refreshToken的操作,避免后端因为token被刷新而导致前一请求失败
		if (needToRefreshToken && $.active <= 1) {

			needToRefreshToken = false;
			// refresh token
			$.put(refreshTokenUrl, credential.refreshToken, {headers: {[REQUEST_TOKEN_HEADER]: credential.id}})
				.then(response => {
					// 更新localStorage中token信息
					setRequestCredential(response);
				}, execAuthFailure);
		}
	}
};


