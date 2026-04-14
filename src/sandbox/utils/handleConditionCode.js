export default function (data) {
  const propertyName = `automa${data.id}`;

  const escapeElementPolicy = (script) => {
    if (window?.trustedTypes?.createPolicy) {
      try {
        const baseNames = [
          'automa-policy',
          'dompurify',
          'default',
          'jSecure',
          'forceInner',
        ];
        let escapeElPolicy = null;

        for (const baseName of baseNames) {
          const uniqueName = `${baseName}-automa-${Date.now().toString(36)}`;
          try {
            escapeElPolicy = window.trustedTypes.createPolicy(uniqueName, {
              createHTML: (to_escape) => to_escape,
              createScript: (to_escape) => to_escape,
            });
            break;
          } catch (e) {
            console.debug(
              `Policy name "${uniqueName}" failed, trying next one`
            );
          }
        }

        if (escapeElPolicy) {
          return escapeElPolicy.createScript(script);
        }
        console.debug(
          'All trusted policy creation attempts failed, falling back to raw script'
        );
        return script;
      } catch (e) {
        console.debug('Error creating trusted policy:', e);
        return script;
      }
    }
    console.debug(`No trusted policy supported`);
    return script;
  };

  const script = document.createElement('script');
  script.textContent = escapeElementPolicy(`
    (async () => {
      function automaRefData(keyword, path = '') {
        if (!keyword) return null;
        if (!path) return ${propertyName}.refData[keyword];

        return window.$getNestedProperties(${propertyName}.refData, keyword + '.' + path);
      }

      try {
        ${data.data.code}
      } catch (error) {
        return {
          $isError: true,
          message: error.message,
        }
      }
    })()
      .then((result) => {
        ${propertyName}.done(result);
      });
  `);

  window[propertyName] = {
    refData: data.refData,
    done: (result) => {
      script.remove();
      delete window[propertyName];

      window.top.postMessage(
        {
          result,
          id: data.id,
          type: 'sandbox',
        },
        '*'
      );
    },
  };

  (document.body || document.documentElement).appendChild(script);
}
