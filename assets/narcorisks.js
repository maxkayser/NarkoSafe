/*!
 * NarcoRisks.js 
 * Interactive Risk Disclosure for Anesthesia Procedures
 * 
 * Author: Max Kayser
 * GitHub: https://github.com/maxkayser/NarcoRisks
 * Version: 1.0
 */

const risksUrl = 'https://raw.githubusercontent.com/maxkayser/NarcoRisks/main/data/risks.json';
let risksData = {};
let allRisks = [];

function htmlToFormattedText(html) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // <br> wird zu \n
  tempDiv.querySelectorAll("br").forEach(br => br.replaceWith("\n"));

  // Block-Elemente
  const blockTags = ['p', 'div', 'section', 'article', 'header', 'footer', 'table', 'tr'];
  blockTags.forEach(tag => {
    tempDiv.querySelectorAll(tag).forEach(el => {
      el.insertAdjacentText("beforebegin", "\n");
      el.insertAdjacentText("afterend", "");
    });
  });

  // Listenpunkte
  tempDiv.querySelectorAll("li").forEach(li => {
    li.insertAdjacentText("beforebegin", "\n- ");
    li.insertAdjacentText("afterend", "\n");
  });

  tempDiv.querySelectorAll("ul, ol").forEach(list => {
    list.insertAdjacentText("beforebegin", "\n");
    list.insertAdjacentText("afterend", "\n");
  });

  return tempDiv.textContent.replace(/\n\s*\n/g, "\n\n").trim();
}

function copyToClipboard() {
  const html = document.getElementById("summaryText")?.innerHTML || "";
  const text = htmlToFormattedText(html);

  const tempTextarea = document.createElement("textarea");
  tempTextarea.style.position = "fixed";
  tempTextarea.style.opacity = "0";
  tempTextarea.value = text;
  document.body.appendChild(tempTextarea);
  tempTextarea.select();
  document.execCommand("copy");
  document.body.removeChild(tempTextarea);

  alert("Text copied to clipboard.");
}

function downloadSummary() {
  const html = document.getElementById("summaryText")?.innerHTML || "";
  const text = htmlToFormattedText(html);

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "aufklaerung.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


/**
 * Loads risk data from the external JSON file.
 * Parses and renders categories, subgroups, and checkboxes dynamically.
 */
async function loadRisks() {
  try {
    const response = await fetch(risksUrl);
    const data = await response.json();

    currentLang = document.getElementById('language').value || "de";
    translations = data.translations || {};
    applyTranslations(currentLang);
    
    textblocks = data.textblocks || {};
    console.log('[loadRisks] Loaded textblocks:', textblocks);

    renderTextblockToggles();
    renderStaticTextblockCheckboxes();

    const rawRoot = data.risks.children[0];
    allRisks = Object.entries(rawRoot)
      .filter(([k, v]) => typeof v === 'object' && v.label)
      .map(([key, value]) => ({
        key,
        label: value.label,
        entries: [
          ...Object.entries(value).filter(([k]) => k === 'common'),
          ...Object.entries(value).filter(([k]) => k !== 'label' && k !== 'common')
        ]
      }));

    risksData = data;

    const defaults = data.defaults || {};
    renderRiskGroups(defaults);
    validatePresets();
    renderProcedureSelectors();
    renderPresetOptions();

  } catch (error) {
    document.getElementById('risksOutput').innerText = 'Error loading risk data.';
    console.error(error);
  }
}

/**
 * Ensures all "common" checkboxes in a group are checked if not already.
 */
function activateCommonItems(groupKey, entriesContainer) {
  const commonItems = entriesContainer.querySelectorAll(`input[value^="${groupKey}.common."]`);
  const anyChecked = Array.from(commonItems).some(cb => cb.checked);
  if (!anyChecked) {
    commonItems.forEach(cb => cb.checked = true);
  }

  const commonGroupCheckbox = entriesContainer.querySelector(`input[type="checkbox"][value="${groupKey}.common"]`);
  if (commonGroupCheckbox && !commonGroupCheckbox.checked) {
    commonGroupCheckbox.checked = true;
  }
}

/**
 * Deactivates "common" checkboxes if no specific risks in the group are checked.
 */
function deactivateCommonIfUnused(groupKey, entriesContainer) {
  const nonCommon = entriesContainer.querySelectorAll(`input[value^="${groupKey}."]:not([value^="${groupKey}.common"])`);
  const anyChecked = Array.from(nonCommon).some(cb => cb.checked);
  if (!anyChecked) {
    const commonBox = entriesContainer.querySelector(`input[type="checkbox"][value="${groupKey}.common"]`);
    if (commonBox) commonBox.checked = false;
    const commonItems = entriesContainer.querySelectorAll(`input[value^="${groupKey}.common."]`);
    commonItems.forEach(cb => cb.checked = false);
  }
}

/**
 * Aktiviert alle Risiken, inkl. Subrisiken eines gegebenen Pfades.
 */
function activateRiskAndChildren(path) {
  const checkbox = document.querySelector(`input[value="${path}"]`);
  
  if (checkbox) {
    if (!checkbox.checked) {
      checkbox.checked = true;
      console.log(`[activateRiskAndChildren] Checkbox aktiviert: ${path}`);
    } else {
      console.log(`[activateRiskAndChildren] Bereits aktiviert: ${path}`);
    }

    // Sichtbarkeit prüfen
    const hiddenAncestor = checkbox.closest('.hidden');
    if (hiddenAncestor) {
      console.warn(`[activateRiskAndChildren] Checkbox ist DOM-seitig versteckt: ${path}`);
    }

  } else {
    console.warn(`[activateRiskAndChildren] Kein <input> mit value="${path}" gefunden.`);
  }

  const prefix = `${path}.`;
  const children = document.querySelectorAll(`input[value^="${prefix}"]`);
  children.forEach(cb => {
    if (!cb.checked) {
      cb.checked = true;
      console.log(`[activateRiskAndChildren] → Subrisiko aktiviert: ${cb.value}`);
    }
  });

  // common aktivieren
  const parts = path.split(".");
  const groupKey = parts[0];
  const allGroups = Array.from(document.querySelectorAll('.category.toggle'));

  for (const groupDiv of allGroups) {
    const groupText = groupDiv.textContent.trim().toLowerCase();
    if (groupText.includes(groupKey.toLowerCase())) {
      const entriesContainer = groupDiv.nextElementSibling;
      if (entriesContainer) {
        activateCommonItems(groupKey, entriesContainer);
        console.log(`[activateRiskAndChildren] common aktiviert für ${groupKey}`);
      }
      break;
    }
  }
}


/**
 * Renders all risk groups, subgroups, and leaf checkboxes dynamically from loaded JSON.
 */
function renderRiskGroups(defaults = {}) {
  const lang = document.getElementById('language').value || 'de';
  const output = document.getElementById('risksOutput');
  output.innerHTML = '';

  for (const group of allRisks) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'category toggle';
    groupDiv.textContent = group.label?.[lang] || group.key;
    output.appendChild(groupDiv);

    const entriesContainer = document.createElement('div');
    entriesContainer.className = 'subcategory checkbox-grid';
    entriesContainer.classList.add('hidden');
    output.appendChild(entriesContainer);

    if (allRisks.indexOf(group) === 0) {
      entriesContainer.classList.remove('hidden');
      groupDiv.classList.add('expanded');
    }

    groupDiv.addEventListener('click', () => {
      entriesContainer.classList.toggle('hidden');
      groupDiv.classList.toggle('expanded');
    });

    for (const [subKey, subValue] of group.entries) {
      const sublabel = subValue.label?.[lang] || subKey;

      if (typeof subValue === 'object' && subValue.label && Object.values(subValue).some(val => val.label)) {
        // Subgroup with nested risks
        const subgroupWrapper = document.createElement('div');
        subgroupWrapper.className = 'subcategory';

        const subgroupHeader = document.createElement('div');
        subgroupHeader.className = 'subgroup-toggle';

        const subgroupCheckbox = document.createElement('input');
        subgroupCheckbox.type = 'checkbox';
        subgroupCheckbox.value = `${group.key}.${subKey}`;
        subgroupCheckbox.style.marginRight = '0.5rem';

        subgroupCheckbox.addEventListener('change', () => {
          const checked = subgroupCheckbox.checked;
          const subInputs = subgroupContainer.querySelectorAll('input[type=checkbox]');
          subInputs.forEach(cb => cb.checked = checked);
          checked && subKey !== 'common'
            ? activateCommonItems(group.key, entriesContainer)
            : deactivateCommonIfUnused(group.key, entriesContainer);
          generateSummary();
        });

        subgroupHeader.appendChild(subgroupCheckbox);
        subgroupHeader.appendChild(document.createTextNode(sublabel));

        const subgroupContainer = document.createElement('div');
        subgroupContainer.className = 'checkbox-grid hidden';

        subgroupHeader.addEventListener('click', (e) => {
          if (e.target.tagName.toLowerCase() !== 'input') {
            const allSubgroups = document.querySelectorAll('.subgroup-toggle + .checkbox-grid');
            const allHeaders = document.querySelectorAll('.subgroup-toggle');

            const isOpen = !subgroupContainer.classList.contains('hidden');
            allSubgroups.forEach(sg => sg.classList.add('hidden'));
            allHeaders.forEach(h => h.classList.remove('expanded'));

            if (!isOpen) {
              subgroupContainer.classList.remove('hidden');
              subgroupHeader.classList.add('expanded');
            }
          }
        });

        // Leaf checkboxes
        for (const [leafKey, leafValue] of Object.entries(subValue)) {
          if (leafKey === 'label') continue;
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.name = 'riskSubgroups';
          checkbox.value = `${group.key}.${subKey}.${leafKey}`;
          const pathLeaf = `risks.${group.key}.${subKey}.${leafKey}`;
          const groupPath = `risks.${group.key}`;
          if (defaults[pathLeaf] || defaults[groupPath]) {
            checkbox.checked = true;
            if (subKey !== 'common') activateCommonItems(group.key, entriesContainer);
          }
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(' ' + (leafValue.label?.[lang] || leafKey)));
          subgroupContainer.appendChild(label);
        }

        const pathSub = `risks.${group.key}.${subKey}`;
        if (defaults[pathSub]) {
          subgroupCheckbox.checked = true;
          const leafCheckboxes = subgroupContainer.querySelectorAll('input[type=checkbox]');
          leafCheckboxes.forEach(cb => cb.checked = true);
          if (subKey !== 'common') activateCommonItems(group.key, entriesContainer);
        }

        subgroupWrapper.appendChild(subgroupHeader);
        subgroupWrapper.appendChild(subgroupContainer);
        entriesContainer.appendChild(subgroupWrapper);

      } else {
        // Flat risks
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'riskSubgroups';
        checkbox.value = `${group.key}.${subKey}`;
        const path = `risks.${group.key}.${subKey}`;
        const groupPath = `risks.${group.key}`;
        if (defaults[path] || defaults[groupPath]) {
          checkbox.checked = true;
          if (subKey !== 'common') activateCommonItems(group.key, entriesContainer);
        }
        checkbox.addEventListener('change', (e) => {
          e.target.checked && subKey !== 'common'
            ? activateCommonItems(group.key, entriesContainer)
            : deactivateCommonIfUnused(group.key, entriesContainer);
          generateSummary();
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + sublabel));
        entriesContainer.appendChild(label);
      }
    }
  }

  generateSummary();
}

function renderProcedureSelectors() {
  const procedures = risksData?.procedures;
  if (!procedures) return;
  
  const lang = currentLang;
  const deptSelect = document.getElementById("departmentSelect");
  const procSelect = document.getElementById("procedureSelect");

  // Reset
  deptSelect.innerHTML = '<option value="">––</option>';
  procSelect.innerHTML = '<option value="">––</option>';
  procSelect.disabled = true;

  // Fachbereiche befüllen
  Object.entries(procedures).forEach(([deptKey, deptVal]) => {
    const opt = document.createElement("option");
    opt.value = deptKey;
    opt.textContent = deptVal.label?.[lang] || deptVal.label?.["en"] || deptKey;
    deptSelect.appendChild(opt);
  });

  deptSelect.addEventListener("change", () => {
    const selectedDept = procedures[deptSelect.value];
    procSelect.innerHTML = '<option value="">––</option>';
    procSelect.disabled = !selectedDept;

    if (selectedDept) {
      Object.entries(selectedDept).forEach(([procKey, procVal]) => {
        if (procKey === "label") return;
        const opt = document.createElement("option");
        opt.value = `${deptSelect.value}.${procKey}`;
        opt.textContent = procVal.label?.[lang] || procVal.label?.["en"] || procKey;
        procSelect.appendChild(opt);
      });
    }
  });

  procSelect.addEventListener("change", () => {
    // Zurücksetzen
    //resetInputs();
    

    const [deptKey, procKey] = procSelect.value.split(".");
    const selected = procedures?.[deptKey]?.[procKey];
    if (!selected || !selected.risks) return;

    // Risiken aktivieren
    selected.risks.forEach(activateRiskAndChildren);

    generateSummary();
  });
}

function findRiskCheckbox(path) {
  const subgroup = document.querySelector(`.subgroup-toggle input[type="checkbox"][value="${path}"]`);
  if (subgroup) return subgroup;

  const exact = document.querySelector(`input[name="riskSubgroups"][value="${path}"]`);
  if (exact) return exact;

  const all = Array.from(document.querySelectorAll('input[name="riskSubgroups"]'));
  return all.find(cb => cb.value.startsWith(path + "."));
}


function validatePresets() {
  const presets = risksData?.presets;
  if (!presets) {
    console.warn("[Validator] No presets found in risksData.");
    return;
  }

  console.log("[Validator] Validating presets...");

  Object.entries(presets).forEach(([presetKey, config]) => {
    Object.entries(config.options || {}).forEach(([optKey, option]) => {
      const label = option.label?.[currentLang] || optKey;
      const riskList = option.associated_risks || [];

      riskList.forEach(path => {
        let effectivePath = path;

        // Normalize relative paths to risks.* for validation
        if (
          !path.startsWith("risks.") &&
          !path.startsWith("textblock.") &&
          !path.startsWith("contextual_risks.")
        ) {
          effectivePath = "risks." + path;
        }

        // Validate as risk path
        if (effectivePath.startsWith("risks.")) {
          const parts = effectivePath.split(".").slice(1);
          let node = risksData.risks?.children?.[0];
          for (const part of parts) {
            node = node?.[part];
            if (!node) break;
          }
          if (!node) {
            console.warn(`[Validator]  Unknown risk path format: ${path} in ${presetKey} → ${optKey}`);
          }
        } else if (effectivePath.startsWith("textblock.") || effectivePath.startsWith("contextual_risks.")) {
          console.log(`[Validator]  Textblock path assumed valid: ${effectivePath}`);
        } else {
          console.warn(`[Validator]  Unknown risk path format: ${path} in ${presetKey} → ${optKey}`);
        }
      });
    });
  });

  console.log("[Validator] Finished.");
}





function handlePresetSelection(key, value) {
  const preset = risksData?.presets?.[key];
  const lang = currentLang || 'de';
  if (!preset) {
    console.warn(`[Preset] No preset found for key: ${key}`);
    return;
  }

  const selected = preset.options?.[value];
  if (!selected) {
    console.warn(`[Preset] No option "${value}" found for preset "${key}"`);
    return;
  }

  console.log(`[PresetSelection] ${key} => ${value}`);
  console.log(`[Preset] Handling selection for key: ${key}, value: ${value}`);
  console.log(`[Preset] ${key} selected: ${selected.label?.[lang] || value}`);

  const riskPaths = selected.associated_risks || [];

  riskPaths.forEach(originalPath => {
    let path = originalPath;

    // Normalize relative paths to risks.
    if (!path.startsWith("risks.") && !path.startsWith("contextual_risks.") && !path.startsWith("textblock.")) {
      path = "risks." + path;
    }

    if (path.startsWith("risks.")) {
      const normalized = path.replace(/^risks\./, "");
      const input = findRiskCheckbox(normalized);

      if (input) {
        input.checked = true;

        const children = document.querySelectorAll(`input[name="riskSubgroups"][value^="${input.value}."]`);
        children.forEach(cb => cb.checked = true);

        const groupKey = input.value.split('.')[0];
        const groupDiv = Array.from(document.querySelectorAll('.category.toggle')).find(div =>
          div.textContent.toLowerCase().includes(groupKey.toLowerCase())
        );
        if (groupDiv) {
          const entriesContainer = groupDiv.nextElementSibling;
          activateCommonItems(groupKey, entriesContainer);
        }

        console.log(`[PresetSelection] Activated risk: ${input.value}`);
        children.forEach(cb => {
          console.log(`[PresetSelection]   → Sub-risk activated: ${cb.value}`);
        });

      } else {
        activateRiskAndChildren(normalized);
        console.log(`[Preset] activateRiskAndChildren() fallback triggered for: ${normalized}`);
      }

    } else if (path.startsWith("contextual_risks.")) {
      const key = path.replace("contextual_risks.", "");
      const checkbox = document.querySelector(`input[name="textblock"][value="${key}"]`);
      if (checkbox) {
        checkbox.checked = true;
        console.log(`[Preset] Contextual textblock activated for: ${key}`);
      } else {
        console.warn(`[Preset] No contextual textblock found for: ${key}`);
      }

    } else if (path.startsWith("textblock.")) {
      const [groupKey, itemKey] = path.replace("textblock.", "").split(".");
      const fullKey = `${groupKey}.${itemKey}`;
      const checkbox = document.querySelector(`input[name="textblock"][value="${fullKey}"]`);
      if (checkbox) {
        checkbox.checked = true;
        console.log(`[Preset] Explicit textblock activated for: ${fullKey}`);
      } else {
        console.warn(`[Preset] No textblock checkbox found for: ${fullKey}`);
      }

    } else {
      console.warn(`[Preset] Unsupported path format: ${path}`);
    }
  });

  generateSummary();
}







function renderPresetOptions() {
  const presets = risksData?.presets;
  if (!presets) {
    console.warn("[PresetOptions] Keine preset_options in JSON gefunden.");
    return;
  }

  console.log("[PresetOptions] Lade Presets:", Object.keys(presets));

  const lang = document.getElementById('language').value || 'de';
  const container = document.getElementById("presetOptionsContainer"); 
  container.innerHTML = '';

  Object.entries(presets).forEach(([key, config]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'preset-group';

    const label = document.createElement('label');
    label.textContent = config.label?.[lang] || key;
    wrapper.appendChild(label);

    const select = document.createElement('select');
    select.id = `preset_${key}`;
    select.innerHTML = `<option value="">–</option>`;

    Object.entries(config.options).forEach(([optKey, optVal]) => {
      const option = document.createElement('option');
      option.value = optKey;
      option.textContent = optVal.label?.[lang] || optKey;
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      // Vorherige Risiken deaktivieren
      document.querySelectorAll('input[name="riskSubgroups"]').forEach(cb => {
        const path = cb.value;
        const allPresetPaths = Object.values(presets).flatMap(opt =>
          Object.values(opt.options || {}).flatMap(conf => conf.associated_risks || [])
        );
        if (allPresetPaths.includes(path)) cb.checked = false;
      });

      const selectedValue = select.value;
      if (selectedValue) {
        console.log(`[PresetSelection] ${key} => ${selectedValue}`);
        handlePresetSelection(key, selectedValue);
      } else {
        generateSummary(); // reset fallback
      }
    });


    wrapper.appendChild(select);
    container.appendChild(wrapper);
  });
}


/**
 * Generates the risk summary output in structured form.
 */
function getLabelFromRiskKey(riskKey, lang = 'de') {
  const path = riskKey.split('.');
  //let node = risks;
  let node = risksData.risks.children[0]

  for (const part of path) {
    if (!node || !node[part]) return null;
    node = node[part];
  }
  return node?.label?.[lang] || null;
}

function getRiskText(riskKey, lang = 'de') {
  const label = getLabelFromRiskKey(riskKey, lang);
  return label ? `– ${label}` : '';
}


function generateSummary() {
  const lang = currentLang || 'de';

  const summaryParts = {
    beginning: [],
    before_measures: [],
    after_measures: [],
    end: []
  };

  const positionMap = {
    "intro": "beginning",
    "before": "before_measures",
    "after": "after_measures",
    "closing": "end"
  };

  // TEXTBLOCKS sammeln
  Object.entries(textblocks).forEach(([groupKey, group]) => {
    Object.entries(group.items || {}).forEach(([itemKey, item]) => {
      const checkbox = document.querySelector(
        `input[name="textblock"][value="${groupKey}.${itemKey}"]`
      );
      if (checkbox?.checked) {
        const text = item.text?.[lang];
        const mapped = positionMap[item.position] || "before_measures";
        if (text && summaryParts[mapped]) {
          summaryParts[mapped].push(text);
        }
      }
    });
  });

  // RISIKEN gruppieren
  const grouped = {};
  document.querySelectorAll('input[name="riskSubgroups"]:checked').forEach(input => {
    const pathParts = input.value.split(".");
    if (pathParts.length < 2) return;

    const [group, subgroup, leaf] = pathParts;
    let node = risksData.risks.children[0];
    for (const part of pathParts) {
      node = node?.[part];
      if (!node) return;
    }

    const label = node?.label?.[lang];
    if (!label) return;

    if (!grouped[group]) grouped[group] = {};
    const sub = subgroup || "default";
    if (!grouped[group][sub]) grouped[group][sub] = [];
    grouped[group][sub].push(label);
  });

  // Freitext
  const additionalText = document.getElementById("additionalText")?.value?.trim();
  if (additionalText) {
    summaryParts.after_measures.push(additionalText);
  }

  // === HTML Formatierung ===

  const htmlParts = [];

  // Textblöcke als <p>
  Object.values(summaryParts.beginning).forEach(txt => htmlParts.push(`<p>${txt}</p>`));
  Object.values(summaryParts.before_measures).forEach(txt => htmlParts.push(`<p>${txt}</p>`));

  // Risiken als strukturierte Liste
  for (const [groupKey, subgroups] of Object.entries(grouped)) {
    const groupLabel = allRisks.find(g => g.key === groupKey)?.label?.[lang] || groupKey;
    const riskItems = [];

    for (const [subKey, labels] of Object.entries(subgroups)) {
      const subgroupNode = risksData.risks.children[0]?.[groupKey]?.[subKey];
      const subLabel = subgroupNode?.label?.[lang] || subKey;
      riskItems.push(`<li><b>${subLabel}:</b> ${labels.join('; ')}</li>`);
    }

    htmlParts.push(`<p><b>${groupLabel}</b><ul>${riskItems.join('')}</ul></p>`);
  }

  Object.values(summaryParts.after_measures).forEach(txt => htmlParts.push(`<p>${txt}</p>`));
  Object.values(summaryParts.end).forEach(txt => htmlParts.push(`<p>${txt}</p>`));

  // In HTML-DIV schreiben
  const output = document.getElementById("summaryText");
  if (output) output.innerHTML = htmlParts.join("\n");
}



/**
 * Renders checkboxes for static textblock insertions (e.g. "online consent").
 */
function renderTextblockToggles() {
  const container = document.getElementById('staticTextblockCheckboxes');
  if (!container || !textblocks) return;
  const lang = document.getElementById('language').value || 'de';
  container.innerHTML = '';

  Object.entries(textblocks).forEach(([groupKey, groupContent]) => {
    if (!groupContent || typeof groupContent !== 'object') return;

    const groupLabel = groupContent.label?.[lang] || groupKey;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'category toggle';
    groupDiv.textContent = groupLabel;
    container.appendChild(groupDiv);

    const subgroupDiv = document.createElement('div');
    subgroupDiv.className = 'subcategory checkbox-grid hidden';
    container.appendChild(subgroupDiv);

    // Auto-expand first group
    if (container.childElementCount === 2) {
      groupDiv.classList.add('expanded');
      subgroupDiv.classList.remove('hidden');
    }

    groupDiv.addEventListener('click', () => {
      subgroupDiv.classList.toggle('hidden');
      groupDiv.classList.toggle('expanded');
    });

    Object.entries(groupContent.items || {}).forEach(([itemKey, item]) => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'textblock';
      checkbox.value = `${groupKey}.${itemKey}`;
      checkbox.addEventListener('change', generateSummary);

      const fullKey = `textblock.${groupKey}.${itemKey}`;
      if (risksData?.defaults?.[fullKey] || item.default === true) {
        checkbox.checked = true;
        console.log(`[Defaults] Activated textblock: ${fullKey}`);
      }

      const label = document.createElement('label');
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + (item.label?.[lang] || itemKey)));
      subgroupDiv.appendChild(label);
    });
  });
}



/**
 * Renders static checkboxes for predefined text blocks (non-dynamic).
 */
function renderStaticTextblockCheckboxes() {
  const lang = document.getElementById('language').value || 'de';
  const container = document.getElementById('staticTextblockCheckboxes');
  container.innerHTML = '';

  if (!textblocks) return;

  Object.entries(textblocks).forEach(([groupKey, group]) => {
    const groupLabel = group?.label?.[lang] || groupKey;

    const groupHeader = document.createElement('div');
    groupHeader.className = 'category toggle';
    groupHeader.textContent = groupLabel;
    container.appendChild(groupHeader);

    const groupContainer = document.createElement('div');
    groupContainer.className = 'subcategory checkbox-grid';
    groupContainer.classList.add('hidden');
    container.appendChild(groupContainer);

    groupHeader.addEventListener('click', () => {
      groupContainer.classList.toggle('hidden');
      groupHeader.classList.toggle('expanded');
    });

    if (group.items) {
      Object.entries(group.items).forEach(([itemKey, itemData]) => {
        const label = itemData.label?.[lang] || itemKey;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'textblock';
        checkbox.value = `${groupKey}.${itemKey}`;
        checkbox.addEventListener('change', generateSummary);

        const fullKey = `${groupKey}.${itemKey}`;
        const altKey = `textblock.${groupKey}.${itemKey}`;

        //const isDefault =
        //  risksData?.defaults?.[fullKey] ||
        //  risksData?.defaults?.[altKey];
        const isDefault = (itemData.default === true) ||
          risksData?.defaults?.[fullKey] ||
          risksData?.defaults?.[altKey];

        if (isDefault) {
          checkbox.checked = true;
          console.log(`[Defaults] Activated textblock default: ${altKey}`);
        }




        const wrapper = document.createElement('label');
        wrapper.appendChild(checkbox);
        wrapper.appendChild(document.createTextNode(' ' + label));
        groupContainer.appendChild(wrapper);
      });
    }
  });
}




document.getElementById('language').addEventListener('change', () => {
  currentLang = document.getElementById('language').value;
  applyTranslations(currentLang); 
  renderRiskGroups();
  renderTextblockToggles();
  renderProcedureSelectors();
  renderPresetOptions();
});

document.getElementById('additionalText').addEventListener('input', generateSummary);

let currentLang = "de";  // Default
let translations = {};   // wird aus data.translations geladen

function getText(path, lang = "de") {
  const parts = path.split(".");
  let node = translations;
  for (const p of parts) {
    if (node && p in node) node = node[p];
    else return "";
  }
  if (typeof node === "string") return node;
  return node[lang] || node["de"] || Object.values(node)[0];
}

function resetInputs() {
  // Alle Checkboxen deaktivieren
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = false;
  });

  // Alle Textareas leeren (außer wenn readonly wie summary)
  document.querySelectorAll('textarea:not([readonly])').forEach(ta => {
    ta.value = '';
  });

  // Alle Selects außer Sprache zurücksetzen
  document.querySelectorAll('select').forEach(select => {
    if (select.id !== 'language') {
      select.selectedIndex = 0;
    }
  });

  // Neurendern der Zusammenfassung
  generateSummary();
}

document.getElementById('resetButton').addEventListener('click', () => {
  resetInputs();
});


function applyTranslations(lang) {
  console.log("[applyTranslations] Lang:", lang);
  console.log("[applyTranslations] Translations:", translations);

  document.documentElement.setAttribute("lang", lang);

  // Textinhalt ersetzen
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const text = getText(key, lang);
    if (text) {
      el.textContent = text;
    } else {
      console.warn(`[i18n] Kein Text gefunden für data-i18n="${key}" und Sprache "${lang}"`);
    }
  });

  // Attribute ersetzen
  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    const attrMap = el.getAttribute("data-i18n-attr").split(",");
    attrMap.forEach(pair => {
      const [attr, key] = pair.split(":");
      const text = getText(key, lang);
      if (text) {
        el.setAttribute(attr, text);
      } else {
        console.warn(`[i18n] Kein Attribut-Text gefunden für ${attr}:${key} und Sprache "${lang}"`);
      }
    });
  });
}

window.onload = loadRisks;
