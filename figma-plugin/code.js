// PixelForge Token Exporter — Figma Plugin
// Professional 요금제에서도 Variables를 JSON으로 내보내는 플러그인

figma.showUI(__html__, { width: 400, height: 480, themeColors: true });

function toHex(n) {
  return Math.round(n * 255).toString(16).padStart(2, '0');
}

function inferTokenType(variable) {
  const scopes = variable.scopes || [];
  const name = variable.name.toLowerCase();

  if (variable.resolvedType === 'COLOR') return 'color';

  if (variable.resolvedType === 'FLOAT') {
    if (scopes.includes('GAP') || scopes.includes('WIDTH_HEIGHT')) return 'spacing';
    if (scopes.includes('CORNER_RADIUS')) return 'radius';
    if (scopes.includes('FONT_SIZE') || scopes.includes('LINE_HEIGHT') || scopes.includes('LETTER_SPACING')) return 'typography';

    if (/spacing|gap|padding|margin/.test(name)) return 'spacing';
    if (/radius|corner|rounded/.test(name)) return 'radius';
    if (/font|line.?height|letter.?spacing/.test(name)) return 'typography';
  }

  return null;
}

function serializeValue(variable, value, type) {
  if (type === 'color' && value.r !== undefined) {
    const hex = '#' + toHex(value.r) + toHex(value.g) + toHex(value.b);
    return {
      value: {
        hex: hex,
        rgba: {
          r: Math.round(value.r * 255),
          g: Math.round(value.g * 255),
          b: Math.round(value.b * 255),
          a: value.a !== undefined ? value.a : 1,
        },
      },
      raw: hex,
    };
  }

  if (type === 'spacing') {
    return {
      value: { gap: value },
      raw: 'gap:' + value,
    };
  }

  if (type === 'radius') {
    return {
      value: { value: value },
      raw: value + 'px',
    };
  }

  if (type === 'typography') {
    return {
      value: { fontFamily: '', fontSize: value, fontWeight: 400 },
      raw: value + 'px',
    };
  }

  return { value: { value: value }, raw: String(value) };
}

async function exportVariables() {
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const tokens = [];

    for (const collection of collections) {
      const defaultMode = collection.modes[0];
      if (!defaultMode) continue;

      for (const varId of collection.variableIds) {
        const variable = await figma.variables.getVariableByIdAsync(varId);
        if (!variable || variable.hiddenFromPublishing) continue;

        const type = inferTokenType(variable);
        if (!type) continue;

        const rawValue = variable.valuesByMode[defaultMode.modeId];
        if (rawValue === undefined || rawValue === null) continue;

        // Skip aliases
        if (typeof rawValue === 'object' && rawValue.type === 'VARIABLE_ALIAS') continue;

        const serialized = serializeValue(variable, rawValue, type);

        tokens.push({
          name: variable.name,
          type: type,
          value: serialized.value,
          raw: serialized.raw,
          mode: defaultMode.name,
          collection: collection.name,
        });
      }
    }

    const result = {
      format: 'pixelforge',
      version: 1,
      exportedAt: new Date().toISOString(),
      tokens: tokens,
    };

    figma.ui.postMessage({
      type: 'export-result',
      data: result,
      tokenCount: tokens.length,
    });
  } catch (err) {
    figma.ui.postMessage({
      type: 'export-error',
      error: err.message || 'Variables 내보내기 실패',
    });
  }
}

figma.ui.onmessage = (msg) => {
  if (msg.type === 'export') {
    exportVariables();
  }
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
