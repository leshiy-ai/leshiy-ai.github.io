// Читаем параметры из URL
const urlParams = new URLSearchParams(window.location.search);
const returnTo = urlParams.get('returnTo') || urlParams.get('auth_origin') || '';
const code = urlParams.get('code');
const deviceId = urlParams.get('device_id');

const VK_CLIENT_ID = 54467300;
const VK_REDIRECT_URL = `${window.location.origin}/vk.html`; // ВК возвращает на vk.html!

// Функция редиректа с ID
const redirectWithId = (userId) => {
  if (returnTo) {
    const separator = returnTo.includes('?') ? '&' : '?';
    window.location.href = `${returnTo}${separator}vk_user_id=${userId}`;
  } else {
    localStorage.setItem('vk_user_id', String(userId));
    localStorage.setItem('auth_provider', 'VK');
    window.location.href = './'; // Возврат на главную GitHub
  }
};

// Загружаем VK ID SDK
const script = document.createElement('script');
script.src = 'https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js';
script.async = true;

script.onload = () => {
  if (!window.VKIDSDK) return;

  const VKID = window.VKIDSDK;

  VKID.Config.init({
    app: VK_CLIENT_ID,
    redirectUrl: VK_REDIRECT_URL,
    responseMode: VKID.ConfigResponseMode.Callback,
    source: VKID.ConfigSource.LOWCODE,
  });

  const rootDiv = document.getElementById('vk_root');

  // Если ВК вернул код (редирект из APK/Мобилки)
  if (code) {
    rootDiv.innerHTML = '<p style="text-align:center; color:white; font-family:sans-serif;">Авторизация...</p>';
    VKID.Auth.exchangeCode(code, deviceId || '')
      .then((data) => {
        const userId = data.user_id || (data.user && data.user.id);
        if (userId) redirectWithId(userId);
        else window.location.href = './vk.html?error=failed';
      })
      .catch(() => window.location.href = './vk.html?error=failed');
  } else {
    // Обычная загрузка - рисуем виджет
    const oneTap = new VKID.OneTap();
    oneTap.render({
      container: rootDiv,
      showAlternativeLogin: true,
      styles: { height: 44, borderRadius: 8 }
    })
    .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
      rootDiv.innerHTML = '<p style="text-align:center; color:white; font-family:sans-serif;">Авторизация...</p>';
      VKID.Auth.exchangeCode(payload.code, payload.device_id)
        .then((data) => {
          const userId = data.user_id || (data.user && data.user.id);
          if (userId) redirectWithId(userId);
        });
    });
  }
};

document.body.appendChild(script);