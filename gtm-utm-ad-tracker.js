<script>
(function(){
  'use strict';

  /* ==========================================================================
     UTILITÁRIOS: Funções para manipulação de query string, cookies e localStorage
  ========================================================================== */

  /**
   * Verifica se localStorage está disponível e funcionando
   * @returns {boolean}
   */
  function isLocalStorageAvailable() {
    var test = 'test';
    try {
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch(e) {
      return false;
    }
  }

  /**
   * Verifica se sessionStorage está disponível e funcionando
   * @returns {boolean}
   */
  function isSessionStorageAvailable() {
    var test = 'test';
    try {
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch(e) {
      return false;
    }
  }

  /**
   * Sanitiza uma string para uso seguro em URLs
   * @param {string} str String para sanitizar
   * @returns {string}
   */
  function sanitizeString(str) {
    if (typeof str !== 'string') {
      return '';
    }
    return str.replace(/[^\w\s-]/g, '').trim();
  }

  /**
   * Retorna o valor de um parâmetro na URL com sanitização.
   * @param {string} name Nome do parâmetro.
   * @param {string} [url] URL para extração (padrão: window.location.href).
   * @returns {string|null}
   */
  function getQueryParam(name, url) {
    if (typeof name !== 'string') {
      return null;
    }
    url = url || window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    try {
      return decodeURIComponent(results[2].replace(/\+/g, " "));
    } catch(e) {
      return null;
    }
  }

  /**
   * Define um cookie com tempo de expiração (em segundos) e domínio customizado.
   * @param {string} name Nome do cookie.
   * @param {string} value Valor do cookie.
   * @param {number} seconds Tempo de expiração em segundos.
   */
  function setCookie(name, value, seconds) {
    if (typeof name !== 'string' || typeof value === 'undefined') {
      return;
    }
    var expires = "";
    if (seconds) {
      var date = new Date();
      date.setTime(date.getTime() + (seconds * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    try {
      document.cookie = name + "=" + encodeURIComponent(value) + 
                       expires + 
                       "; path=/; domain=.{{0 | Dominio}}; SameSite=Lax; Secure";
    } catch(e) {
      console.warn('Erro ao definir cookie:', e);
    }
  }

  /**
   * Retorna o valor de um cookie pelo nome.
   * @param {string} name Nome do cookie.
   * @returns {string|null}
   */
  function getCookie(name) {
    if (typeof name !== 'string') {
      return null;
    }
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
      var c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) {
        try {
          return decodeURIComponent(c.substring(nameEQ.length));
        } catch(e) {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Gera um identificador único simples, combinando timestamp e número aleatório.
   * @returns {string}
   */
  function generateUID() {
    return [
      new Date().getTime(),
      Math.floor(Math.random() * 1000000)
    ].join('');
  }

  /**
   * Atualiza (ou cria) o objeto de localStorage na key "stape".
   * @param {Object} newData Objeto com as propriedades a serem atualizadas.
   * @returns {boolean} Sucesso da operação
   */
  function updateStapeStorage(newData) {
    if (!isLocalStorageAvailable() || !newData || typeof newData !== 'object') {
      return false;
    }

    var stapeData = {};
    try {
      var existing = localStorage.getItem('stape');
      if (existing && typeof existing === 'string') {
        var parsed = JSON.parse(existing);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          stapeData = parsed;
        }
      }
    } catch(e) {
      stapeData = {};
    }

    // Limita o histórico de toques para evitar exceder quota
    if (stapeData.touchHistory && Array.isArray(stapeData.touchHistory)) {
      if (stapeData.touchHistory.length > 50) {
        stapeData.touchHistory = stapeData.touchHistory.slice(-50);
      }
    }

    for (var key in newData) {
      if (newData.hasOwnProperty(key) && typeof newData[key] !== 'undefined') {
        stapeData[key] = newData[key];
      }
    }

    try {
      var dataString = JSON.stringify(stapeData);
      if (dataString.length > 2097152) { // 2MB limit
        console.warn('Storage data exceeds 2MB limit');
        return false;
      }
      localStorage.setItem('stape', dataString);
      return true;
    } catch(e) {
      console.warn('Error updating storage:', e);
      return false;
    }
  }

  /* ==========================================================================
     CONFIGURAÇÕES: Parâmetros e chaves
  ========================================================================== */

  var EXPIRY_SECONDS = 31536000; // 1 ano (em segundos)
  var utmParams = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','ad_id'];
  var clickParams = ['fbclid','gclid','gclig','ttclid','xclid'];
  var cookiePrefix = 'trk_';
  var VERSION = '1.2.0'; // Atualizado versionamento
  var SESSION_KEY = 'current_session';

  /* ==========================================================================
     ETAPA 1: Recuperação / Criação do identificador único "xcod" e sessão
  ========================================================================== */
  var xcod = getCookie(cookiePrefix + 'xcod');
  var sessionId;
  
  // Verifica se já existe uma sessão atual
  if (isSessionStorageAvailable()) {
    sessionId = sessionStorage.getItem(cookiePrefix + SESSION_KEY);
    if (!sessionId) {
      sessionId = generateUID();
      sessionStorage.setItem(cookiePrefix + SESSION_KEY, sessionId);
    }
  }
  
  if (!xcod) {
    xcod = generateUID();
    setCookie(cookiePrefix + 'xcod', xcod, EXPIRY_SECONDS);
    if (isLocalStorageAvailable()) {
      updateStapeStorage({ xcod: xcod, version: VERSION });
      try {
        sessionStorage.setItem(cookiePrefix + 'xcod', xcod);
      } catch(e) {}
    }
  }

  /* ==========================================================================
     ETAPA 2: Gravação dos dados de "entrada" (fixos no primeiro acesso)
  ========================================================================== */
  var dataEntradaCookie = getCookie(cookiePrefix + 'data_entrada');
  var entryData = {};

  if (!dataEntradaCookie) {
    for (var i = 0; i < utmParams.length; i++) {
      var param = utmParams[i];
      entryData[param] = getQueryParam(param) || "";
      setCookie(cookiePrefix + param, entryData[param], EXPIRY_SECONDS);
    }
    
    for (var j = 0; j < clickParams.length; j++) {
      var clickParam = clickParams[j];
      var val = getQueryParam(clickParam);
      if (val) {
        entryData[clickParam] = val;
        setCookie(cookiePrefix + clickParam, val, EXPIRY_SECONDS);
      }
    }

    if (!entryData['utm_source'] || entryData['utm_source'] === "") {
      try {
        entryData['utm_source'] = document.referrer ? 
          (document.referrer.split('/')[2] || "indefinido") : 
          "direto";
      } catch(e) {
        entryData['utm_source'] = "indefinido";
      }
      setCookie(cookiePrefix + 'utm_source', entryData['utm_source'], EXPIRY_SECONDS);
    }

    entryData['data_entrada'] = new Date().getTime();
    setCookie(cookiePrefix + 'data_entrada', entryData['data_entrada'], EXPIRY_SECONDS);
    entryData['xcod'] = xcod;
    updateStapeStorage(entryData);
  } else {
    try {
      var stapeEntry = localStorage.getItem('stape');
      if (stapeEntry) {
        entryData = JSON.parse(stapeEntry);
      }
    } catch(e) {
      entryData = {};
    }
  }

  /* ==========================================================================
     ETAPA 3: Coleta dos parâmetros "atuais" (dinâmicos a cada acesso)
  ========================================================================== */
  var currentData = {};
  
  for (var k = 0; k < utmParams.length; k++) {
    currentData[utmParams[k]] = getQueryParam(utmParams[k]) || "";
  }
  
  if (!currentData['utm_source'] || currentData['utm_source'] === "") {
    try {
      currentData['utm_source'] = document.referrer ? 
        (document.referrer.split('/')[2] || "indefinido") : 
        "direto";
    } catch(e) {
      currentData['utm_source'] = "indefinido";
    }
  }
  
  for (var l = 0; l < clickParams.length; l++) {
    var currentClickParam = clickParams[l];
    var currentVal = getQueryParam(currentClickParam);
    if (currentVal) {
      currentData[currentClickParam] = currentVal;
    }
  }
  
  currentData['dataAtual'] = new Date().getTime();
  currentData['xcod'] = xcod;
  if (sessionId) {
    currentData['sessionId'] = sessionId;
  }

  /* ==========================================================================
     ETAPA 4: Construção dos parâmetros customizados para a URL
  ========================================================================== */
  function buildCustomParam(suffix, dataObj) {
    var values = [];
    for (var i = 0; i < utmParams.length; i++) {
      values.push(dataObj[utmParams[i]] || "");
    }
    return values.join("|") + "|" + (dataObj['data' + suffix] || "");
  }

  var srcParam = buildCustomParam("entrada", entryData);
  var sckParam = buildCustomParam("Atual", currentData);

  /* ==========================================================================
     ETAPA 5: Atualização da URL do navegador
  ========================================================================== */
  (function updateBrowserURL(){
    try {
      var currentUrl = window.location.href;
      var baseUrl = window.location.pathname;
      var hash = window.location.hash;
      var params = [];
      var queryStart = currentUrl.indexOf('?');
      var existingParams = {};
      
      if (queryStart !== -1) {
        var query = currentUrl.slice(queryStart + 1);
        var pairs = query.split('&');
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i].split('=');
          if (pair[0] !== 'src' && pair[0] !== 'sck') {
            params.push(pairs[i]);
            existingParams[pair[0]] = true;
          }
        }
      }
      
      if (!existingParams.src) {
        params.push('src=' + encodeURIComponent(srcParam));
      }
      if (!existingParams.sck) {
        params.push('sck=' + encodeURIComponent(sckParam));
      }
      
      var newUrl = baseUrl + (params.length ? '?' + params.join('&') : '') + hash;
      window.history.replaceState(null, "", newUrl);
    } catch(e) {
      console.warn('Error updating URL:', e);
    }
  })();

  /* ==========================================================================
     ETAPA 6: (OPCIONAL) Atualização de links/botões específicos
  ========================================================================== */
  function updateButtons() {
    var links = document.getElementsByTagName('a');
    var paymentDomain = 'payment.seusite.com';
    
    for (var i = 0; i < links.length; i++) {
      var el = links[i];
      try {
        if (el.href && el.href.indexOf(paymentDomain) > -1) {
          var url = el.href;
          var separator = url.indexOf('?') === -1 ? '?' : '&';
          
          // Adiciona xcod
          if (url.indexOf('xcod=') === -1) {
            url += separator + 'xcod=' + encodeURIComponent(xcod);
            separator = '&';
          }
          
          el.href = url;
        }
      } catch(e) {
        console.warn('Error updating link:', el, e);
      }
    }
  }
  // Descomente para ativar a atualização de links
  // updateButtons();

  /* ==========================================================================
     ETAPA 7: Armazenamento do Histórico de Touches (Um por sessão, cada sessão gera um novo)
  ========================================================================== */
  function updateTouchHistory(currentUTMData) {
    if (!isLocalStorageAvailable() || !currentUTMData) {
      return false;
    }

    var stapeData = {};
    try {
      var stored = localStorage.getItem('stape');
      if (stored) {
        stapeData = JSON.parse(stored);
      }
    } catch(e) {
      stapeData = {};
    }

    var history = Array.isArray(stapeData.touchHistory) ? stapeData.touchHistory : [];
    
    // Verificar se já existe um touch para esta sessão
    var sessionTouch = null;
    var touchSessionKey = cookiePrefix + 'touch_session';
    var touchRegistered = false;
    
    // Verificar se já registramos um touch para esta sessão específica
    if (isSessionStorageAvailable() && sessionId) {
      touchRegistered = sessionStorage.getItem(touchSessionKey) === sessionId;
      
      // Se já registramos, encontre-o no histórico para atualizações
      if (touchRegistered) {
        for (var i = 0; i < history.length; i++) {
          if (history[i].sessionId === sessionId) {
            sessionTouch = history[i];
            break;
          }
        }
      }
    }
    
    // Se já existe um touch para esta sessão, apenas atualize os parâmetros UTM
    if (sessionTouch) {
      for (var j = 0; j < utmParams.length; j++) {
        var param = utmParams[j];
        // Só atualiza se o novo valor não for vazio
        if (currentUTMData[param] && currentUTMData[param] !== "") {
          sessionTouch.utm[param] = currentUTMData[param];
        }
      }
      // Atualiza também os parâmetros de clique
      for (var k = 0; k < clickParams.length; k++) {
        var clickParam = clickParams[k];
        if (currentUTMData[clickParam] && currentUTMData[clickParam] !== "") {
          if (!sessionTouch.clickParams) {
            sessionTouch.clickParams = {};
          }
          sessionTouch.clickParams[clickParam] = currentUTMData[clickParam];
        }
      }
    } 
    // Se não existe, cria um novo touch para esta sessão
    else {
      var newTouch = {
        utm: {},
        timestamp: new Date().getTime()
      };
      
      if (sessionId) {
        newTouch.sessionId = sessionId;
      }

      for (var m = 0; m < utmParams.length; m++) {
        var utmParam = utmParams[m];
        newTouch.utm[utmParam] = currentUTMData[utmParam] || "";
      }
      
      // Adiciona parâmetros de clique também
      var hasClickParams = false;
      for (var n = 0; n < clickParams.length; n++) {
        var cp = clickParams[n];
        if (currentUTMData[cp] && currentUTMData[cp] !== "") {
          if (!newTouch.clickParams) {
            newTouch.clickParams = {};
          }
          newTouch.clickParams[cp] = currentUTMData[cp];
          hasClickParams = true;
        }
      }

      var shouldAddTouch = false;
      
      // Verifica se há algum UTM não vazio
      for (var o = 0; o < utmParams.length; o++) {
        if (newTouch.utm[utmParams[o]] && newTouch.utm[utmParams[o]] !== "") {
          shouldAddTouch = true;
          break;
        }
      }
      
      // Adiciona o touch se tiver UTMs ou parâmetros de clique
      if (shouldAddTouch || hasClickParams) {
        history.push(newTouch);
        
        // Marca esta sessão como já tendo um touch registrado
        if (isSessionStorageAvailable() && sessionId) {
          sessionStorage.setItem(touchSessionKey, sessionId);
        }
      }
    }
    
    // Mantém apenas os últimos 50 toques
    if (history.length > 50) {
      history = history.slice(-50);
    }
    
    stapeData.touchHistory = history;
    try {
      localStorage.setItem('stape', JSON.stringify(stapeData));
      return true;
    } catch(e) {
      console.warn('Error updating touch history:', e);
      return false;
    }
  }

  var hasNewUTM = false;
  for (var m = 0; m < utmParams.length; m++) {
    if (currentData[utmParams[m]] && currentData[utmParams[m]] !== "") {
      hasNewUTM = true;
      break;
    }
  }
  
  // Verifica também parâmetros de clique
  if (!hasNewUTM) {
    for (var n = 0; n < clickParams.length; n++) {
      if (currentData[clickParams[n]] && currentData[clickParams[n]] !== "") {
        hasNewUTM = true;
        break;
      }
    }
  }
  
  if (hasNewUTM) {
    updateTouchHistory(currentData);
  }

  /* ==========================================================================
     EXPOSIÇÃO DOS DADOS
  ========================================================================== */
  window._trackingData = {
    version: VERSION,
    xcod: xcod,
    sessionId: sessionId,
    entryData: entryData,
    currentData: currentData,
    src: srcParam,
    sck: sckParam
  };

  console.info("%cAUTORIA: Vinícius Fonseca - Agência Murupi Marketing Digital, Automaçòes e Inteligência Artificial", "color: gray; font-size: 10px;");

})();
</script>