(function () {
  var API = '/api/club';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function telHref(phone) {
    if (!phone) return '';
    var d = phone.replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 11 && d.charAt(0) === '8') d = '7' + d.slice(1);
    if (d.length === 10) d = '7' + d;
    return 'tel:+' + d;
  }

  function ensureMeta(attr, key, content) {
    if (!content) return;
    var sel = 'meta[' + attr + '="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function applySeo(club) {
    var name = club.name || 'стопКЕК';
    var path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    var pageTitles = {
      '/': club.seoTitle || name + ' — компьютерный клуб',
      '/support': 'Поддержка — ' + name,
      '/privacy': 'Политика конфиденциальности — ' + name,
      '/terms': 'Пользовательское соглашение — ' + name,
      '/offer': 'Публичная оферта — ' + name,
    };
    var title = pageTitles[path] || name + ' — компьютерный клуб';
    document.title = title;

    var desc =
      club.seoDescription ||
      'Компьютерный клуб ' +
        name +
        '. Бронь и оплата игровых мест через мобильное приложение. Круглосуточно.';
    var ogDesc = club.seoOgDescription || 'Компьютерный клуб ' + name + ' · бронь через приложение';

    ensureMeta('name', 'description', desc);
    ensureMeta('property', 'og:title', title);
    ensureMeta('property', 'og:description', path === '/' ? ogDesc : desc);
    ensureMeta('property', 'og:type', 'website');
    ensureMeta('property', 'og:url', location.href.split('#')[0]);
    ensureMeta('property', 'og:locale', 'ru_RU');
    ensureMeta('property', 'og:site_name', name);

    var old = document.getElementById('club-jsonld');
    if (old) old.remove();
    var ld = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: name,
      url: 'https://stopkek.site',
      description: desc,
    };
    if (club.supportPhone) ld.telephone = club.supportPhone;
    if (club.supportEmail) ld.email = club.supportEmail;
    // адрес в JSON-LD не кладём — заказчик: SEO без адреса
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'club-jsonld';
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);
  }

  function composite(key, club) {
    switch (key) {
      case 'innOgrnip':
        return club.inn && club.ogrnip ? 'ИНН ' + club.inn + ' · ОГРНИП ' + club.ogrnip : '';
      case 'innOgrnipColon':
        return club.inn && club.ogrnip ? 'ИНН: ' + club.inn + ' · ОГРНИП: ' + club.ogrnip : '';
      case 'clubAddressBadge':
        return club.address
          ? club.address + (club.hours ? ' · режим работы ' + club.hours : '')
          : '';
      case 'clubAddressLine':
        return club.address ? 'Клуб: ' + club.address : '';
      case 'legalAddressLine':
        return club.legalAddress ? 'Юридический адрес: ' + club.legalAddress : '';
      case 'heroTag':
        return club.hours ? 'Компьютерный клуб · ' + club.hours : '';
      case 'copyright':
        return '© ' + new Date().getFullYear() + ' ' + (club.name || 'стопКЕК') + ' · stopkek.site';
      case 'offerOperatorMeta':
        return club.operatorName && club.inn && club.ogrnip
          ? club.operatorName + ' · ИНН ' + club.inn + ' · ОГРНИП ' + club.ogrnip
          : '';
      default:
        return '';
    }
  }

  function compositeHtml(key, club) {
    switch (key) {
      case 'privacyOperator':
        return [
          club.operatorName ? '<strong>' + esc(club.operatorName) + '</strong>' : '',
          club.inn && club.ogrnip
            ? 'ИНН: ' + esc(club.inn) + ' · ОГРНИП: ' + esc(club.ogrnip)
            : '',
          club.legalAddress ? 'Юр. адрес: ' + esc(club.legalAddress) : '',
          club.supportEmail
            ? 'Email: <a href="mailto:' +
              esc(club.supportEmail) +
              '">' +
              esc(club.supportEmail) +
              '</a>'
            : '',
          club.supportPhone
            ? 'Тел: <a href="' +
              esc(telHref(club.supportPhone)) +
              '">' +
              esc(club.supportPhone) +
              '</a>'
            : '',
        ]
          .filter(Boolean)
          .join('<br />\n        ');
      case 'offerRequisites':
        return [
          club.operatorName ? esc(club.operatorName) : '',
          club.inn && club.ogrnip
            ? 'ИНН ' + esc(club.inn) + ' · ОГРНИП ' + esc(club.ogrnip)
            : '',
          club.legalAddress ? esc(club.legalAddress) : '',
          club.address ? 'Клуб: ' + esc(club.address) : '',
          [
            club.supportEmail
              ? '<a href="mailto:' +
                esc(club.supportEmail) +
                '">' +
                esc(club.supportEmail) +
                '</a>'
              : '',
            club.supportPhone
              ? '<a href="' +
                esc(telHref(club.supportPhone)) +
                '">' +
                esc(club.supportPhone) +
                '</a>'
              : '',
          ]
            .filter(Boolean)
            .join(' · '),
        ]
          .filter(Boolean)
          .join('<br />\n        ');
      default:
        return '';
    }
  }

  function apply(club) {
    applySeo(club);

    document.querySelectorAll('[data-club]').forEach(function (el) {
      var key = el.getAttribute('data-club');
      if (!key) return;
      var value = Object.prototype.hasOwnProperty.call(club, key) ? club[key] : composite(key, club);
      if (!value) return;

      var prefix = el.getAttribute('data-club-prefix') || '';
      var link = el.getAttribute('data-club-link');
      if (link === 'mailto') {
        el.href = 'mailto:' + value;
        el.textContent = prefix + value;
      } else if (link === 'tel') {
        el.href = telHref(value);
        el.textContent = prefix + value;
      } else {
        el.textContent = prefix + value;
      }
    });

    document.querySelectorAll('[data-club-html]').forEach(function (el) {
      var key = el.getAttribute('data-club-html');
      if (!key) return;
      var html = compositeHtml(key, club);
      if (html) el.innerHTML = html;
    });

    document.querySelectorAll('[data-club-contacts]').forEach(function (el) {
      var parts = [];
      if (club.supportEmail) {
        parts.push(
          '<a href="mailto:' +
            esc(club.supportEmail) +
            '">' +
            esc(club.supportEmail) +
            '</a>'
        );
      }
      if (club.supportPhone) {
        parts.push(
          '<a href="' +
            esc(telHref(club.supportPhone)) +
            '">' +
            esc(club.supportPhone) +
            '</a>'
        );
      }
      if (parts.length) el.innerHTML = parts.join(' · ');
    });
  }

  fetch(API)
    .then(function (res) {
      return res.ok ? res.json() : Promise.reject(new Error('club fetch failed'));
    })
    .then(apply)
    .catch(function () {
      /* оставляем статический fallback в HTML */
    });
})();
