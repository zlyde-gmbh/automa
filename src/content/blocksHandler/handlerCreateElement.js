import handleSelector from '../handleSelector';

const positions = {
  after: 'beforeend',
  before: 'afterbegin',
  'next-sibling': 'afterend',
  'prev-sibling': 'beforebegin',
};

function createNode(tag, attrs = {}, content = '') {
  const element = document.createElement(tag);

  Object.keys(attrs).forEach((attr) => {
    element.setAttribute(attr, attrs[attr]);
  });
  element.innerHTML = content;

  return element;
}

async function createElement(block) {
  const targetElement = await handleSelector(block);
  if (!targetElement) throw new Error('element-not-found');

  const { data, id } = block;
  const baseId = `automa-${id}`;

  if (data.insertAt === 'replace') {
    const fragments = createNode('template', {}, data.html);
    targetElement.replaceWith(fragments.content);
  } else {
    targetElement.insertAdjacentHTML(positions[data.insertAt], data.html);
  }

  if (data.css) {
    const style = createNode('style', { id: `${baseId}-style` }, data.css);
    document.body.appendChild(style);
  }

  if (block.preloadCSS) {
    block.preloadCSS.forEach((style) => {
      const script = document.createElement('style');
      script.id = `${baseId}-script`;
      script.textContent = style.script;

      document.body.appendChild(script);
    });
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
  if (!data?.dontInjectJS) {
    data.preloadScripts.forEach((item) => {
      const script = document.createElement(item.type);
      script.id = `${baseId}-script`;
      script.textContent = item.script;

      document.body.appendChild(script);
    });

    const script = document.createElement('script');
    script.id = `${baseId}-javascript`;
    script.textContent = escapeElementPolicy(
      `(() => { ${data.automaScript}\n${data.javascript} })()`
    );

    document.body.appendChild(script);
  }

  return true;
}

export default createElement;
