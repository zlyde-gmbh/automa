import { jsContentHandler } from '@/workflowEngine/utils/javascriptBlockUtil';
import { getDocumentCtx } from '../handleSelector';

function javascriptCode({ data, isPreloadScripts, frameSelector }) {
  if (!isPreloadScripts && Array.isArray(data))
    return jsContentHandler(...data);
  if (!data.scripts) return Promise.resolve({ success: true });

  let $documentCtx = document;

  if (frameSelector) {
    const iframeCtx = getDocumentCtx(frameSelector);
    if (!iframeCtx) return Promise.resolve({ success: false });

    $documentCtx = iframeCtx;
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
  data.scripts.forEach((script) => {
    const scriptAttr = `block--${script.id}`;

    const isScriptExists = $documentCtx.querySelector(
      `.automa-custom-js[${scriptAttr}]`
    );

    if (isScriptExists) return;

    const scriptEl = $documentCtx.createElement('script');
    scriptEl.textContent = escapeElementPolicy(script.data.code);
    scriptEl.setAttribute(scriptAttr, '');
    scriptEl.classList.add('automa-custom-js');

    $documentCtx.documentElement.appendChild(scriptEl);
  });

  return Promise.resolve({ success: true });
}

export default javascriptCode;
