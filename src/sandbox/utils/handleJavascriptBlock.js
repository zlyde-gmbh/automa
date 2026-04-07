import { nanoid } from 'nanoid/non-secure';

export default function (data) {
  let timeout;
  const instanceId = nanoid();
  const scriptId = `script${data.id}`;
  const propertyName = `automa${data.id}`;

  const isScriptExists = document.querySelector(`#${scriptId}`);
  if (isScriptExists) {
    window.top.postMessage(
      {
        id: data.id,
        type: 'sandbox',
        result: {
          columns: {},
          variables: {},
        },
      },
      '*'
    );

    return;
  }

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
  const preloadScripts = data.preloadScripts.map((item) => {
    const scriptEl = document.createElement('script');
    scriptEl.textContent = escapeElementPolicy(item.script);

    (document.body || document.documentElement).appendChild(scriptEl);

    return scriptEl;
  });

  if (!data.blockData.code.includes('automaNextBlock')) {
    data.blockData.code += `\n automaNextBlock()`;
  }

  const script = document.createElement('script');
  script.id = scriptId;
  script.textContent = escapeElementPolicy(`
    (() => {
      function automaRefData(keyword, path = '') {
        if (!keyword) return null;
        if (!path) return ${propertyName}.refData[keyword];

        return window.$getNestedProperties(${propertyName}.refData, keyword + '.' + path);
      }
      function automaSetVariable(name, value) {
        const variables = ${propertyName}.refData.variables;
        if (!variables) ${propertyName}.refData.variables = {}

        ${propertyName}.refData.variables[name] = value;
      }
      function automaNextBlock(data = {}, insert = true) {
        ${propertyName}.nextBlock({ data, insert });
      }
      function automaResetTimeout() {
        ${propertyName}.resetTimeout();
      }
      function automaFetch(type, resource) {
        return ${propertyName}.fetch(type, resource);
      }

      try {
        ${data.blockData.code}
      } catch (error) {
        console.error(error);
        automaNextBlock({ $error: true, message: error.message });
      }
    })();
  `);

  function cleanUp() {
    script.remove();
    preloadScripts.forEach((preloadScript) => {
      preloadScript.remove();
    });

    delete window[propertyName];
  }

  window[propertyName] = {
    refData: data.refData,
    nextBlock: (result) => {
      cleanUp();
      window.top.postMessage(
        {
          id: data.id,
          type: 'sandbox',
          result: {
            variables: data?.refData?.variables,
            columns: {
              data: result?.data,
              insert: result?.insert,
            },
          },
        },
        '*'
      );
    },
    resetTimeout: () => {
      clearTimeout(timeout);
      timeout = setTimeout(cleanUp, data.blockData.timeout);
    },
    fetch: (type, resource) => {
      return new Promise((resolve, reject) => {
        const types = ['json', 'text'];
        if (!type || !types.includes(type)) {
          reject(new Error('The "type" must be "text" or "json"'));
          return;
        }

        window.top.postMessage(
          {
            type: 'automa-fetch',
            data: { id: instanceId, type, resource },
          },
          '*'
        );

        const eventName = `automa-fetch-response-${instanceId}`;

        const eventListener = ({ detail }) => {
          window.removeEventListener(eventName, eventListener);

          if (detail.isError) {
            reject(new Error(detail.result));
          } else {
            resolve(detail.result);
          }
        };

        window.addEventListener(eventName, eventListener);
      });
    },
  };

  timeout = setTimeout(cleanUp, data.blockData.timeout);
  (document.body || document.documentElement).appendChild(script);
}
