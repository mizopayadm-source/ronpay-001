import React, { useState } from 'react';
import { X, Plus, Trash2, Edit3, Check, CheckCircle2, Users, Bookmark, Save, Sparkles, RefreshCw } from 'lucide-react';
import { SectionQuickPreset } from '../types';
import { getStoredSectionPresets, saveStoredSectionPresets, DEFAULT_SECTION_PRESETS } from '../utils/storage';

interface SectionPresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreset?: (preset: SectionQuickPreset) => void;
  currentSections?: string[];
  currentLabel?: string;
  isAdmin?: boolean;
}

export const SectionPresetManagerModal: React.FC<SectionPresetManagerModalProps> = ({
  isOpen,
  onClose,
  onApplyPreset,
  currentSections,
  currentLabel,
  isAdmin = false,
}) => {
  const [presets, setPresets] = useState<SectionQuickPreset[]>(() => getStoredSectionPresets());
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  // Form states for creating / editing preset
  const [formName, setFormName] = useState<string>('');
  const [formLabel, setFormLabel] = useState<string>('Bial / Section');
  const [formSections, setFormSections] = useState<string[]>([]);
  const [newSectionInput, setNewSectionInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPresets(getStoredSectionPresets());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleStartCreate = () => {
    setFormName('');
    setFormLabel(currentLabel || 'Bial / Section');
    setFormSections(currentSections && currentSections.length > 0 ? [...currentSections] : []);
    setNewSectionInput('');
    setEditingPresetId(null);
    setIsCreatingNew(true);
  };

  const handleStartEdit = (p: SectionQuickPreset) => {
    setFormName(p.name);
    setFormLabel(p.label);
    setFormSections([...p.sections]);
    setNewSectionInput('');
    setEditingPresetId(p.id);
    setIsCreatingNew(true);
  };

  const handleAddSectionToForm = () => {
    const trimmed = newSectionInput.trim();
    if (!trimmed) return;
    const items = trimmed
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const newItems = items.filter(s => !formSections.includes(s));
    if (newItems.length > 0) {
      setFormSections([...formSections, ...newItems]);
      setNewSectionInput('');
    }
  };

  const handleRemoveSectionFromForm = (idxToRemove: number) => {
    setFormSections(formSections.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSavePresetForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Khawngaihin Preset Hming ziak rawh le (e.g. Kohhran Bial 1-5).');
      return;
    }
    if (formSections.length === 0) {
      alert('Khawngaihin a tlem berah Section pakhat tal dah rawh le.');
      return;
    }

    let updated: SectionQuickPreset[];
    if (editingPresetId) {
      updated = presets.map(p => {
        if (p.id === editingPresetId) {
          return {
            ...p,
            name: formName.trim(),
            label: formLabel.trim() || 'Bial / Section',
            sections: formSections,
          };
        }
        return p;
      });
      showToast(`✅ "${formName.trim()}" preset update fel a ni e!`);
    } else {
      const newPreset: SectionQuickPreset = {
        id: `preset-${Date.now()}`,
        name: formName.trim(),
        label: formLabel.trim() || 'Bial / Section',
        sections: formSections,
        createdAt: new Date().toISOString(),
      };
      updated = [...presets, newPreset];
      showToast(`🎉 Preset thar "${formName.trim()}" siam fel a ni e!`);
    }

    setPresets(updated);
    saveStoredSectionPresets(updated);
    setIsCreatingNew(false);
    setEditingPresetId(null);
  };

  const handleDeletePreset = (id: string, name: string) => {
    if (!confirm(`He preset "${name}" hi i delete duh tak tak em?`)) return;
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    saveStoredSectionPresets(updated);
    showToast(`🗑️ Preset paih fel a ni e.`);
  };

  const handleResetToDefault = () => {
    if (!confirm('Quick Presets zawng zawng hi Default (System Default)-ah reset i duh em?')) return;
    setPresets(DEFAULT_SECTION_PRESETS);
    saveStoredSectionPresets(DEFAULT_SECTION_PRESETS);
    showToast('🔄 Default presets-ah reset fel a ni e.');
  };

  // Quick action: Save currently entered sections from campaign directly
  const handleQuickSaveCurrentSections = () => {
    if (!currentSections || currentSections.length === 0) {
      alert('He bawm-ah hian section a la awm lo.');
      return;
    }
    const defaultName = prompt('He Quick Preset thar hming tur hi chhu lut rawh:', `${currentLabel || 'Custom'} Preset`);
    if (!defaultName || !defaultName.trim()) return;

    const newPreset: SectionQuickPreset = {
      id: `preset-${Date.now()}`,
      name: defaultName.trim(),
      label: currentLabel?.trim() || 'Bial / Section',
      sections: [...currentSections],
      createdAt: new Date().toISOString(),
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    saveStoredSectionPresets(updated);
    showToast(`🎉 "${defaultName.trim()}" preset atan save fel a ni e!`);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-5 border border-slate-200 shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">
                Bial / Section Quick Presets Setup
              </h3>
              <p className="text-[10.5px] text-slate-500 font-medium">
                Admin & Bawm siamtu-ten 1-click a an thlan nghal theih tur preset-te
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Current sections quick save banner if applicable */}
        {!isCreatingNew && currentSections && currentSections.length > 0 && (
          <div className="bg-blue-50/80 p-3 rounded-2xl border border-blue-200 flex flex-col xs:flex-row xs:items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-extrabold text-blue-950 block">
                Bawm Sections Siam Lai ({currentSections.length} sections)
              </span>
              <p className="text-[10.5px] text-blue-800 font-medium">
                Label: <b>{currentLabel || 'Bial / Section'}</b>
              </p>
            </div>
            <button
              type="button"
              onClick={handleQuickSaveCurrentSections}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 shrink-0"
              title="Save these current sections as a reusable quick preset"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save as Preset</span>
            </button>
          </div>
        )}

        {/* Main Content: Form or List */}
        {isCreatingNew ? (
          /* PRESET CREATE / EDIT FORM */
          <form onSubmit={handleSavePresetForm} className="space-y-3.5 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-blue-600" />
                <span>{editingPresetId ? 'Preset Siamthatna (Edit Preset)' : 'Quick Preset Thar Siamna'}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingPresetId(null);
                }}
                className="text-slate-500 hover:text-slate-800 font-bold text-[11px] cursor-pointer"
              >
                ✕ Cancel
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                Preset Hming (Display Name) *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. ⛪ Kohhran (Bial 1-5) emaw 🏛️ Branch Unit"
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                Dropdown Label (Dynamic Title) *
              </label>
              <input
                type="text"
                required
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Bial / Unit emaw Section / Veng"
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1">
                Section List ({formSections.length} sections)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newSectionInput}
                  onChange={(e) => setNewSectionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSectionToForm();
                    }
                  }}
                  placeholder="+ Section hming thar (e.g. Bial 1)..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={handleAddSectionToForm}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer active:scale-95 shrink-0"
                >
                  + Add
                </button>
              </div>

              {/* Tag Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-36 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                {formSections.length === 0 ? (
                  <span className="text-[10.5px] text-slate-400 p-2 italic">
                    Section a la awm lo. A chunga input-ah khian section hming ziak la, Add hmet rawh.
                  </span>
                ) : (
                  formSections.map((sec, idx) => (
                    <span
                      key={idx}
                      className="bg-blue-50 border border-blue-200 text-blue-900 font-bold px-2 py-1 rounded-lg text-[10.5px] flex items-center gap-1 shadow-2xs"
                    >
                      <span>{sec}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSectionFromForm(idx)}
                        className="text-rose-500 hover:text-rose-700 font-black cursor-pointer ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingPresetId(null);
                }}
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{editingPresetId ? 'Update Preset' : 'Save Quick Preset'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* PRESET LIST */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Preset Awmsa Te ({presets.length})
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Preset Thar Siamna</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-slate-50 hover:bg-blue-50/40 p-3 rounded-2xl border border-slate-200 hover:border-blue-300 transition space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                        <span>{preset.name}</span>
                        <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                          {preset.sections.length} sections
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Dropdown Label: <b className="text-slate-700">{preset.label}</b>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onApplyPreset && (
                        <button
                          type="button"
                          onClick={() => {
                            onApplyPreset(preset);
                            showToast(`✓ "${preset.name}" apply nghal a ni e!`);
                            setTimeout(onClose, 600);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10.5px] transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                          title="Apply this preset to the current form"
                        >
                          <Check className="w-3 h-3" />
                          <span>Apply</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartEdit(preset)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 p-1.5 rounded-lg transition cursor-pointer"
                        title="Edit preset"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset.id, preset.name)}
                        className="bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 hover:border-rose-300 p-1.5 rounded-lg transition cursor-pointer"
                        title="Delete preset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Section Chips Preview */}
                  <div className="flex flex-wrap gap-1">
                    {preset.sections.map((sec, sIdx) => (
                      <span
                        key={sIdx}
                        className="text-[9.5px] bg-white border border-slate-200 text-slate-700 font-medium px-2 py-0.5 rounded-md"
                      >
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer reset button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
                title="Reset to system defaults"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Default Presets-ah Reset Rawh</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
