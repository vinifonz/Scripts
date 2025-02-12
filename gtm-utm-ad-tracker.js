<script>
(function(){
  'use strict';

  /* ==========================================================================
     UTILITÁRIOS: Funções para manipulação de query string, cookies e localStorage
  ========================================================================== */

  /**
   * Retorna o valor de um parâmetro na URL.
   * @param {string} name Nome do parâmetro.
   * @param {string} [url] URL para extração (padrão: window.location.href).
   * @returns {string|null}
   */
  function getQueryParam(name, url) {
    url = url || window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  /**
   * Define um cookie com tempo de expiração (em segundos) e domínio customizado.
   * Substitua o domínio conforme sua necessidade.
   * @param {string} name Nome do cookie.
   * @param {string} value Valor do cookie.
   * @param {number} seconds Tempo de expiração em segundos.
   */
  function setCookie(name, value, seconds) {
    var expires = "";
    if (seconds) {
      var date = new Date();
      date.setTime(date.getTime() + seconds * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; domain=.{{0 | Dominio}}; SameSite=Lax; Secure";
  }

  /**
   * Retorna o valor de um cookie pelo nome.
   * @param {string} name Nome do cookie.
   * @returns {string|null}
   */
  function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++){
      var c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
    }
    return null;
  }

  /**
   * Gera um identificador único simples, combinando timestamp e número aleatório.
   * @returns {string}
   */
  function generateUID() {
    // Gerado sem prefixo, apenas timestamp + número aleatório.
    return new Date().getTime() + '' + Math.floor(Math.random() * 1000000);
  }

  /**
   * Atualiza (ou cria) o objeto de localStorage na key "stape".
   * Os dados são armazenados como um objeto JSON.
   * @param {Object} newData Objeto com as propriedades a serem atualizadas.
   */
  function updateStapeStorage(newData) {
    var stapeData = {};
    try {
      var existing = localStorage.getItem('stape');
      if (existing) {
        stapeData = JSON.parse(existing);
      }
    } catch(e) {
      stapeData = {};
    }
    for (var key in newData) {
      if (newData.hasOwnProperty(key)) {
        stapeData[key] = newData[key];
      }
    }
    localStorage.setItem('stape', JSON.stringify(stapeData));
  }

  /* ==========================================================================
     CONFIGURAÇÕES: Parâmetros e chaves
  ========================================================================== */

  var EXPIRY_SECONDS = 31536000; // 1 ano (em segundos)
  // Atualizamos a lista de parâmetros utm para incluir "utm_id" e "ad_id"
  var utmParams = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','ad_id'];
  // Atualizamos os parâmetros de clique para incluir "gclig" (caso haja variações)
  var clickParams = ['fbclid','gclid','gclig','ttclid','xclid'];
  var cookiePrefix = 'trk_';

  /* ==========================================================================
     ETAPA 1: Recuperação / Criação do identificador único "xcod"
  ========================================================================== */
  var xcod = getCookie(cookiePrefix + 'xcod');
  if (!xcod) {
    xcod = generateUID();
    setCookie(cookiePrefix + 'xcod', xcod, EXPIRY_SECONDS);
    updateStapeStorage({ xcod: xcod });
    sessionStorage.setItem(cookiePrefix + 'xcod', xcod);
  }

  /* ==========================================================================
     ETAPA 2: Gravação dos dados de "entrada" (fixos no primeiro acesso)
     - Se o cookie trk_data_entrada não existir, os dados serão coletados e salvos.
  ========================================================================== */
  var dataEntradaCookie = getCookie(cookiePrefix + 'data_entrada');
  var entryData = {};

  if (!dataEntradaCookie) {
    utmParams.forEach(function(param) {
      entryData[param] = getQueryParam(param) || "";
      setCookie(cookiePrefix + param, entryData[param], EXPIRY_SECONDS);
    });
    clickParams.forEach(function(param) {
      var val = getQueryParam(param);
      if (val) {
        entryData[param] = val;
        setCookie(cookiePrefix + param, val, EXPIRY_SECONDS);
      }
    });
    if (!entryData['utm_source'] || entryData['utm_source'] === "") {
      entryData['utm_source'] = document.referrer ? (new URL(document.referrer).hostname || "indefinido") : "direto";
      setCookie(cookiePrefix + 'utm_source', entryData['utm_source'], EXPIRY_SECONDS);
    }
    entryData['data_entrada'] = Date.now();
    setCookie(cookiePrefix + 'data_entrada', entryData['data_entrada'], EXPIRY_SECONDS);
    entryData['xcod'] = xcod;
    // Você pode adicionar outras chaves conforme necessário, por exemplo:
    // entryData['gtm_nome'] = 'nome';
    // entryData['ftid'] = 'vinifo@gmail.com';
    // entryData['phone'] = '+5598882829182';
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
  utmParams.forEach(function(param) {
    currentData[param] = getQueryParam(param) || "";
  });
  
  // Se utm_source estiver vazio, aplica o fallback semelhante ao entryData
  if (!currentData['utm_source'] || currentData['utm_source'] === "") {
    currentData['utm_source'] = document.referrer ? (new URL(document.referrer).hostname || "indefinido") : "direto";
  }
  
  clickParams.forEach(function(param) {
    var val = getQueryParam(param);
    if (val) {
      currentData[param] = val;
    }
  });
  currentData['dataAtual'] = Date.now();
  currentData['xcod'] = xcod;


  /* ==========================================================================
     ETAPA 4: Construção dos parâmetros customizados para a URL
     - "src": dados de entrada no formato:
           utm_sourceEntrada|utm_mediumEntrada|utm_campaignEntrada|utm_termEntrada|utm_contentEntrada|[utm_id]|[ad_id]|data_entrada
     - "sck": dados atuais no formato:
           utm_sourceAtual|utm_mediumAtual|utm_campaignAtual|utm_termAtual|utm_contentAtual|[utm_id]|[ad_id]|dataAtual
  ========================================================================== */
  function buildCustomParam(suffix, dataObj) {
    return utmParams.map(function(param) {
      return dataObj[param] || "";
    }).join("|") + "|" + (dataObj['data' + suffix] || "");
  }

  var srcParam = buildCustomParam("entrada", entryData);
  var sckParam = buildCustomParam("Atual", currentData);

  /* ==========================================================================
     ETAPA 5: Atualização da URL do navegador
     Insere os parâmetros "src" e "sck" na URL para resiliência em navegações internas.
  ========================================================================== */
  (function updateBrowserURL(){
    var searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.has('src')) {
      searchParams.set('src', srcParam);
    }
    if (!searchParams.has('sck')) {
      searchParams.set('sck', sckParam);
    }
    // Para atualizar sempre os valores atuais, descomente as linhas abaixo:
    // searchParams.set('src', srcParam);
    // searchParams.set('sck', sckParam);
    var newRelativePathQuery = window.location.pathname + '?' + searchParams.toString() + window.location.hash;
    window.history.replaceState(null, "", newRelativePathQuery);
  })();

  /* ==========================================================================
     ETAPA 6: (OPCIONAL) Atualização de links/botões específicos com os dados coletados
     Exemplo de como injetar o "xcod" (ou outros parâmetros) em links específicos.
  ========================================================================== */
  /*
  (function updateButtons(){
    var links = document.getElementsByTagName('a');
    for(var i = 0; i < links.length; i++){
      var el = links[i];
      try {
        if(el.href && el.href.indexOf('https://payment.seusite.com') > -1){
          var urlObj = new URL(el.href);
          urlObj.searchParams.set('xcod', xcod);
          // Para injetar também "src" ou "sck", use:
          // urlObj.searchParams.set('src', srcParam);
          // urlObj.searchParams.set('sck', sckParam);
          el.href = urlObj.toString();
        }
      } catch(e) {
        console.warn("Erro ao atualizar link: ", el, e);
      }
    }
  })();
  */

  /* ==========================================================================
     ETAPA 7: Armazenamento do Histórico de Touches
     Para tornar o rastreamento mais robusto e possibilitar uma atribuição multi-touch,
     registramos cada toque (quando os parâmetros UTM estiverem presentes) em um histórico.
  ========================================================================== */
  function updateTouchHistory(currentUTMData) {
    var stapeData = {};
    try {
      stapeData = JSON.parse(localStorage.getItem('stape')) || {};
    } catch(e) {
      stapeData = {};
    }
    var history = stapeData.touchHistory || [];
    // Cria um novo toque com os parâmetros UTM e timestamp.
    var newTouch = {
      utm: {},
      timestamp: Date.now()
    };
    utmParams.forEach(function(param) {
      newTouch.utm[param] = currentUTMData[param] || "";
    });
    // Evita duplicações: adiciona o toque se for diferente do último registrado.
    if (history.length === 0 || JSON.stringify(history[history.length - 1].utm) !== JSON.stringify(newTouch.utm)) {
      history.push(newTouch);
    }
    stapeData.touchHistory = history;
    localStorage.setItem('stape', JSON.stringify(stapeData));
  }
  // Se houver ao menos um dos parâmetros UTM na visita atual, atualiza o histórico.
  var hasNewUTM = utmParams.some(function(param) {
    return currentData[param] && currentData[param] !== "";
  });
  if (hasNewUTM) {
    updateTouchHistory(currentData);
  }

  /* ==========================================================================
     EXPOSIÇÃO DOS DADOS (OPCIONAL)
     Os dados coletados são expostos via variável global _trackingData, 
     facilitando a utilização em outras tags ou Data Variables no GTM.
  ========================================================================== */
  window._trackingData = {
    xcod: xcod,
    entryData: entryData,
    currentData: currentData,
    src: srcParam,
    sck: sckParam
  };

  /* ==========================================================================
     LISTA DE ARMAZENAMENTO CRIADO PELO SCRIPT
     - Cookies (salvos individualmente com prefixo "trk_"):
         • trk_xcod: Identificador único do visitante.
         • trk_data_entrada: Timestamp do primeiro acesso (em milissegundos).
         • trk_utm_source: Valor do parâmetro utm_source (ou hostname do referrer se ausente).
         • trk_utm_medium: Valor do parâmetro utm_medium.
         • trk_utm_campaign: Valor do parâmetro utm_campaign.
         • trk_utm_term: Valor do parâmetro utm_term.
         • trk_utm_content: Valor do parâmetro utm_content.
         • trk_utm_id: Valor do parâmetro utm_id.
         • trk_ad_id: Valor do parâmetro ad_id.
         • (Outros cookies de clique, se presentes, como trk_fbclid, trk_gclid, etc.)
     
     - localStorage:
         • stape: Objeto JSON contendo as entradas de dados (ex.: utm_source, utm_medium, data_entrada, xcod, etc.),
                  incluindo o histórico de toques em "touchHistory".
     
     - sessionStorage:
         • trk_xcod: Armazenamento temporário do identificador único para a sessão atual.
  ========================================================================== */

  // AUTORIA (exibida de forma discreta no console)
  console.info("%cAUTORIA: Vinícius Fonseca - Agência Murupi Marketing Digital, Automaçòes e Inteligência Artificial", "color: gray; font-size: 10px;");

})();
</script>