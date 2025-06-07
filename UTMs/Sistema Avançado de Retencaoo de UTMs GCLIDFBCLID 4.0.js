<script>
/**
 * @name: Sistema Avançado de Retenção de UTMs + GCLID/FBCLID
 * @version: 4.0
 * @date: 2025-06-07
 * @description: Sistema completo para capturar, reter e gerenciar UTMs, GCLID e FBCLID com fallback para referral, armazenamento múltiplo e manutenção na URL do navegador
 * @author: Vinícius Fonseca - Agência Murupi - contato@agenciamurupi.com
 */

(function() {
  'use strict';
  
  // Configurações do sistema
  var config = {
    cookieExpireDays: 365, // Cookies de primeiro acesso expiram em 1 ano
    sessionCookieExpireDays: 1, // Cookies de sessão expiram em 1 dia
    updateBrowserUrl: true, // Se deve atualizar a URL do navegador
    updateInternalLinks: true, // Se deve adicionar parâmetros em links internos
    preserveExistingParams: true, // Se deve preservar outros parâmetros da URL
    // Parâmetros de rastreamento (UTMs + Click IDs)
    trackingParams: {
      utm: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
      clickIds: ['gclid', 'fbclid'],
      all: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']
    },
    storageKeys: {
      firstVisit: 'utm_first_visit',
      currentVisit: 'utm_current_visit',
      timestamps: 'utm_timestamps'
    }
  };

  // Função para obter parâmetros da URL
  function getUrlParameter(name, url) {
    url = url || window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    var results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  // Função para obter todos os parâmetros da URL
  function getAllUrlParameters(url) {
    url = url || window.location.href;
    var params = {};
    var urlParts = url.split('?');
    
    if (urlParts.length > 1) {
      var queryString = urlParts[1].split('#')[0]; // Remove fragment se existir
      var pairs = queryString.split('&');
      
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        if (pair.length === 2) {
          var key = decodeURIComponent(pair[0]);
          var value = decodeURIComponent(pair[1].replace(/\+/g, ' '));
          params[key] = value;
        }
      }
    }
    
    return params;
  }

  // Função para construir URL com parâmetros
  function buildUrlWithParams(baseUrl, params) {
    var url = baseUrl.split('?')[0].split('#')[0]; // Remove query e fragment
    var fragment = '';
    
    // Preservar fragment se existir
    var hashIndex = baseUrl.indexOf('#');
    if (hashIndex > -1) {
      fragment = baseUrl.substring(hashIndex);
    }
    
    var queryParams = [];
    for (var key in params) {
      if (params[key] !== null && params[key] !== '') {
        queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }
    
    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }
    
    return url + fragment;
  }

  // Função para verificar se é um link interno
  function isInternalLink(url) {
    try {
      var linkDomain = new URL(url, window.location.origin).hostname;
      var currentDomain = window.location.hostname;
      return linkDomain === currentDomain;
    } catch (e) {
      // Se não conseguir parsear, assume que é interno (links relativos)
      return true;
    }
  }

  // Função para analisar referral e gerar UTMs
  function generateUtmsFromReferral(referral) {
    var utms = {
      utm_source: 'direct',
      utm_medium: 'direct',
      utm_campaign: 'direct',
      utm_content: '',
      utm_term: ''
    };

    if (!referral || referral === '') {
      return utms;
    }

    // Extrair domínio do referral
    var referralDomain = '';
    try {
      var referralUrl = new URL(referral);
      referralDomain = referralUrl.hostname.toLowerCase();
    } catch (e) {
      return utms;
    }

    // Mapear domínios conhecidos para sources
    var sourceMapping = {
      'google.com': { source: 'google', medium: 'organic' },
      'google.com.br': { source: 'google', medium: 'organic' },
      'google.co.uk': { source: 'google', medium: 'organic' },
      'bing.com': { source: 'bing', medium: 'organic' },
      'yahoo.com': { source: 'yahoo', medium: 'organic' },
      'duckduckgo.com': { source: 'duckduckgo', medium: 'organic' },
      'facebook.com': { source: 'facebook', medium: 'social' },
      'instagram.com': { source: 'instagram', medium: 'social' },
      'twitter.com': { source: 'twitter', medium: 'social' },
      'x.com': { source: 'twitter', medium: 'social' },
      'linkedin.com': { source: 'linkedin', medium: 'social' },
      'youtube.com': { source: 'youtube', medium: 'social' },
      'whatsapp.com': { source: 'whatsapp', medium: 'social' },
      'telegram.org': { source: 'telegram', medium: 'social' },
      'pinterest.com': { source: 'pinterest', medium: 'social' },
      'tiktok.com': { source: 'tiktok', medium: 'social' },
      'reddit.com': { source: 'reddit', medium: 'social' },
      'snapchat.com': { source: 'snapchat', medium: 'social' }
    };

    // Verificar se é um domínio conhecido
    for (var domain in sourceMapping) {
      if (referralDomain.indexOf(domain) > -1) {
        utms.utm_source = sourceMapping[domain].source;
        utms.utm_medium = sourceMapping[domain].medium;
        utms.utm_campaign = 'referral_' + sourceMapping[domain].source;
        return utms;
      }
    }

    // Se não for conhecido, usar o domínio como source
    utms.utm_source = referralDomain.replace('www.', '');
    utms.utm_medium = 'referral';
    utms.utm_campaign = 'referral_' + utms.utm_source;

    return utms;
  }

  // Função para definir cookie
  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  // Função para obter cookie
  function getCookie(name) {
    var nameEQ = name + '=';
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  }

  // Função para salvar dados em todos os storages
  function saveToAllStorages(key, data, isPermanent) {
    var jsonData = JSON.stringify(data);
    
    // LocalStorage (permanente)
    if (typeof Storage !== 'undefined' && localStorage) {
      try {
        localStorage.setItem(key, jsonData);
      } catch (e) {
        console.warn('UTM System: Erro ao salvar no localStorage:', e);
      }
    }

    // SessionStorage (sessão)
    if (typeof Storage !== 'undefined' && sessionStorage) {
      try {
        sessionStorage.setItem(key, jsonData);
      } catch (e) {
        console.warn('UTM System: Erro ao salvar no sessionStorage:', e);
      }
    }

    // Cookies
    var cookieDays = isPermanent ? config.cookieExpireDays : config.sessionCookieExpireDays;
    setCookie(key, jsonData, cookieDays);
  }

  // Função para recuperar dados de qualquer storage
  function getFromAnyStorage(key) {
    var data = null;

    // Tentar localStorage primeiro
    if (typeof Storage !== 'undefined' && localStorage) {
      try {
        data = localStorage.getItem(key);
        if (data) return JSON.parse(data);
      } catch (e) {
        console.warn('UTM System: Erro ao ler localStorage:', e);
      }
    }

    // Tentar sessionStorage
    if (typeof Storage !== 'undefined' && sessionStorage) {
      try {
        data = sessionStorage.getItem(key);
        if (data) return JSON.parse(data);
      } catch (e) {
        console.warn('UTM System: Erro ao ler sessionStorage:', e);
      }
    }

    // Tentar cookies
    try {
      data = getCookie(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('UTM System: Erro ao ler cookie:', e);
    }

    return null;
  }

  // Função para atualizar a URL do navegador
  function updateBrowserUrl(trackingData) {
    if (!config.updateBrowserUrl || !window.history || !window.history.replaceState) {
      return;
    }

    try {
      var currentUrl = window.location.href;
      var currentParams = getAllUrlParameters(currentUrl);
      
      // Manter parâmetros existentes se configurado
      var newParams = config.preserveExistingParams ? currentParams : {};
      
      // Adicionar/atualizar parâmetros de rastreamento
      for (var i = 0; i < config.trackingParams.all.length; i++) {
        var param = config.trackingParams.all[i];
        if (trackingData[param] && trackingData[param] !== '') {
          newParams[param] = trackingData[param];
        }
      }
      
      // Construir nova URL
      var newUrl = buildUrlWithParams(currentUrl, newParams);
      
      // Atualizar URL se for diferente da atual
      if (newUrl !== currentUrl) {
        window.history.replaceState(window.history.state, document.title, newUrl);
      }
    } catch (e) {
      console.warn('UTM System: Erro ao atualizar URL:', e);
    }
  }

  // Função para adicionar parâmetros de rastreamento aos links internos
  function enhanceInternalLinks(trackingData) {
    if (!config.updateInternalLinks) {
      return;
    }

    // Esperar um pouco para garantir que o DOM está carregado
    setTimeout(function() {
      var links = document.getElementsByTagName('a');
      
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var href = link.href;
        
        if (href && isInternalLink(href)) {
          // Verificar se já tem event listener
          if (link.getAttribute('data-tracking-enhanced') === 'true') {
            continue;
          }
          
          // Marcar como processado
          link.setAttribute('data-tracking-enhanced', 'true');
          
          // Adicionar event listener
          link.addEventListener('click', function(e) {
            var clickedLink = e.target;
            while (clickedLink && clickedLink.tagName !== 'A') {
              clickedLink = clickedLink.parentNode;
            }
            
            if (clickedLink && clickedLink.href) {
              var linkParams = getAllUrlParameters(clickedLink.href);
              
              // Adicionar parâmetros atuais se não existirem
              var currentTrackingData = getFromAnyStorage(config.storageKeys.currentVisit);
              if (currentTrackingData) {
                for (var j = 0; j < config.trackingParams.all.length; j++) {
                  var param = config.trackingParams.all[j];
                  if (!linkParams[param] && currentTrackingData[param]) {
                    linkParams[param] = currentTrackingData[param];
                  }
                }
                
                // Atualizar href do link
                clickedLink.href = buildUrlWithParams(clickedLink.href, linkParams);
              }
            }
          });
        }
      }
    }, 500);
  }

  // Função principal para capturar e processar parâmetros de rastreamento
  function processTrackingData() {
    var currentTimestamp = new Date().getTime();
    var referral = document.referrer || '';

    // Capturar todos os parâmetros de rastreamento da URL atual
    var currentTrackingData = {};
    for (var i = 0; i < config.trackingParams.all.length; i++) {
      var param = config.trackingParams.all[i];
      currentTrackingData[param] = getUrlParameter(param);
    }

    // Verificar se há parâmetros de rastreamento na URL atual
    var hasCurrentTrackingData = false;
    for (var param in currentTrackingData) {
      if (currentTrackingData[param]) {
        hasCurrentTrackingData = true;
        break;
      }
    }

    // Se não há parâmetros na URL, tentar recuperar da sessão atual
    if (!hasCurrentTrackingData) {
      var savedCurrentData = getFromAnyStorage(config.storageKeys.currentVisit);
      if (savedCurrentData) {
        // Usar dados salvos da sessão atual
        for (var param in currentTrackingData) {
          if (savedCurrentData[param]) {
            currentTrackingData[param] = savedCurrentData[param];
            hasCurrentTrackingData = true;
          }
        }
      }
    }

    // Se ainda não há UTMs, gerar a partir do referral (mas manter click IDs vazios)
    if (!hasCurrentTrackingData) {
      var generatedUtms = generateUtmsFromReferral(referral);
      // Aplicar apenas UTMs geradas, deixar click IDs em branco
      for (var i = 0; i < config.trackingParams.utm.length; i++) {
        var utmParam = config.trackingParams.utm[i];
        currentTrackingData[utmParam] = generatedUtms[utmParam];
      }
      // Click IDs permanecem em branco se não estiverem na URL
      for (var j = 0; j < config.trackingParams.clickIds.length; j++) {
        var clickIdParam = config.trackingParams.clickIds[j];
        if (!currentTrackingData[clickIdParam]) {
          currentTrackingData[clickIdParam] = '';
        }
      }
    }

    // Recuperar dados de primeira visita
    var firstVisitData = getFromAnyStorage(config.storageKeys.firstVisit);
    var timestampsData = getFromAnyStorage(config.storageKeys.timestamps);

    // Se é a primeira visita, salvar como dados permanentes
    if (!firstVisitData) {
      firstVisitData = {
        utm_source: currentTrackingData.utm_source,
        utm_medium: currentTrackingData.utm_medium,
        utm_campaign: currentTrackingData.utm_campaign,
        utm_content: currentTrackingData.utm_content,
        utm_term: currentTrackingData.utm_term,
        gclid: currentTrackingData.gclid,
        fbclid: currentTrackingData.fbclid,
        referrer: referral
      };

      timestampsData = {
        first_visit: currentTimestamp,
        current_visit: currentTimestamp
      };

      // Salvar dados de primeira visita (permanente)
      saveToAllStorages(config.storageKeys.firstVisit, firstVisitData, true);
      saveToAllStorages(config.storageKeys.timestamps, timestampsData, true);
    } else {
      // Atualizar timestamp da visita atual
      timestampsData.current_visit = currentTimestamp;
      saveToAllStorages(config.storageKeys.timestamps, timestampsData, true);
    }

    // Sempre salvar dados atuais (sessão)
    var currentVisitData = {
      utm_source: currentTrackingData.utm_source,
      utm_medium: currentTrackingData.utm_medium,
      utm_campaign: currentTrackingData.utm_campaign,
      utm_content: currentTrackingData.utm_content,
      utm_term: currentTrackingData.utm_term,
      gclid: currentTrackingData.gclid,
      fbclid: currentTrackingData.fbclid,
      referrer: referral
    };

    saveToAllStorages(config.storageKeys.currentVisit, currentVisitData, false);

    // Atualizar URL do navegador
    updateBrowserUrl(currentTrackingData);

    // Melhorar links internos
    enhanceInternalLinks(currentTrackingData);

    // Enviar dados para o dataLayer
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      'event': 'tracking_data_processed',
      // UTMs de primeira visita
      'utm_first_source': firstVisitData.utm_source,
      'utm_first_medium': firstVisitData.utm_medium,
      'utm_first_campaign': firstVisitData.utm_campaign,
      'utm_first_content': firstVisitData.utm_content,
      'utm_first_term': firstVisitData.utm_term,
      'utm_first_referrer': firstVisitData.referrer,
      // Click IDs de primeira visita
      'gclid_first': firstVisitData.gclid,
      'fbclid_first': firstVisitData.fbclid,
      // UTMs atuais
      'utm_current_source': currentTrackingData.utm_source,
      'utm_current_medium': currentTrackingData.utm_medium,
      'utm_current_campaign': currentTrackingData.utm_campaign,
      'utm_current_content': currentTrackingData.utm_content,
      'utm_current_term': currentTrackingData.utm_term,
      'utm_current_referrer': referral,
      // Click IDs atuais
      'gclid_current': currentTrackingData.gclid,
      'fbclid_current': currentTrackingData.fbclid,
      // Timestamps
      'first_visit_timestamp': timestampsData.first_visit,
      'current_visit_timestamp': timestampsData.current_visit,
      // Meta informações
      'url_updated': config.updateBrowserUrl,
      'has_gclid': !!(currentTrackingData.gclid),
      'has_fbclid': !!(currentTrackingData.fbclid)
    });
  }

  // Função global para recuperar dados de rastreamento para uso em outros eventos
  window.getTrackingData = function() {
    var firstVisit = getFromAnyStorage(config.storageKeys.firstVisit) || {};
    var currentVisit = getFromAnyStorage(config.storageKeys.currentVisit) || {};
    var timestamps = getFromAnyStorage(config.storageKeys.timestamps) || {};

    return {
      first: firstVisit,
      current: currentVisit,
      timestamps: timestamps,
      sessionDuration: timestamps.current_visit && timestamps.first_visit ? 
        timestamps.current_visit - timestamps.first_visit : 0,
      // Funções de conveniência
      hasGclid: function() { return !!(currentVisit.gclid || firstVisit.gclid); },
      hasFbclid: function() { return !!(currentVisit.fbclid || firstVisit.fbclid); },
      isDirectTraffic: function() { return currentVisit.utm_source === 'direct'; },
      isPaidGoogle: function() { return !!(currentVisit.gclid || firstVisit.gclid); },
      isPaidFacebook: function() { return !!(currentVisit.fbclid || firstVisit.fbclid); }
    };
  };

  // Manter compatibilidade com versão anterior
  window.getUtmData = window.getTrackingData;

  // Função global para forçar atualização (útil para SPAs)
  window.forceTrackingUpdate = function() {
    processTrackingData();
  };

  // Manter compatibilidade com versão anterior
  window.forceUtmUpdate = window.forceTrackingUpdate;

  // Executar o processamento
  processTrackingData();

  // Reprocessar em mudanças de URL (útil para SPAs)
  var originalPushState = window.history.pushState;
  var originalReplaceState = window.history.replaceState;

  window.history.pushState = function() {
    originalPushState.apply(window.history, arguments);
    setTimeout(processTrackingData, 100);
  };

  window.history.replaceState = function() {
    originalReplaceState.apply(window.history, arguments);
    setTimeout(processTrackingData, 100);
  };

  // Escutar evento de popstate (botão voltar/avançar)
  window.addEventListener('popstate', function() {
    setTimeout(processTrackingData, 100);
  });

})();
</script>