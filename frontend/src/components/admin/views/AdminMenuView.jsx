import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  X,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
  Layers,
} from 'lucide-react';
import api from '../../../services/api';

const PRESET_UNITS = [
  '250 gm',
  '500 gm',
  '1 kg',
  '1 No.',
  '1 Pc',
  'Half',
  'Full',
  '200 ml',
  '500 ml',
  '1 Ltr',
  'Regular',
  'Large',
  'Plate',
  'Cup',
  'Glass',
];

const resolveImageUrl = (url) => {
  if (!url || typeof url !== 'string' || url.trim() === '') return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/')) {
    return `http://localhost:5001${trimmed}`;
  }
  return trimmed;
};

const AdminMenuView = ({ inventory = [], onRefresh, showToast }) => {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);

  // Group items by groupName or name
  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [inventory, selectedCategory, searchTerm]);

  const categories = useMemo(() => {
    const cats = new Set(inventory.map((item) => item.category || 'General'));
    return ['ALL', ...Array.from(cats)];
  }, [inventory]);

  const existingGroups = useMemo(() => {
    const groups = new Set();
    inventory.forEach((item) => {
      const group = item.groupName || item.name;
      if (group) groups.add(group);
    });
    return Array.from(groups).sort();
  }, [inventory]);

  const filteredGrouped = useMemo(() => {
    const groups = {};
    filteredItems.forEach((item) => {
      const key = item.groupName || item.name;
      if (!groups[key]) groups[key] = { groupKey: key, variants: [] };
      groups[key].variants.push(item);
    });
    return Object.values(groups);
  }, [filteredItems]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'Lunch',
    groupName: '',
    customGroup: '',
    prepTime: '10',
    description: '',
    stock: '50',
    isAvailable: true,
    imageUrl: '',
    variants: [
      { id: null, unit: '250 gm', customUnit: '', price: '' }
    ]
  });

  const [imageMode, setImageMode] = useState('url'); // 'url' | 'file'
  const [customCategory, setCustomCategory] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [pendingBase64, setPendingBase64] = useState(null);
  const [imageError, setImageError] = useState('');

  const handleOpenAdd = (defaultGroup = null) => {
    let group = defaultGroup || '';
    let category = 'Lunch';
    let description = '';
    let imageUrl = '';
    let prepTime = '10';
    let stock = '50';

    if (defaultGroup) {
      const existing = inventory.find(i => (i.groupName || i.name) === defaultGroup);
      if (existing) {
        category = existing.category || 'Lunch';
        description = existing.description || '';
        imageUrl = existing.imageUrl || '';
        prepTime = String(existing.prepTime ?? '10');
        stock = String(existing.stock ?? '50');
      }
    }

    setFormData({
      name: group || '',
      category,
      groupName: existingGroups.includes(group) ? group : (group ? 'CUSTOM' : ''),
      customGroup: existingGroups.includes(group) ? '' : group,
      prepTime,
      description,
      stock,
      isAvailable: true,
      imageUrl,
      variants: [
        { id: null, unit: '250 gm', customUnit: '', price: '' }
      ]
    });

    setImageMode(imageUrl && !imageUrl.startsWith('data:') ? 'url' : 'url');
    setCustomCategory('');
    setImagePreview(imageUrl || null);
    setPendingBase64(null);
    setImageError('');
    setShowItemModal(true);
  };

  const handleOpenEditGroup = (groupKey, variantsList) => {
    const primary = variantsList[0];
    const isCustomGrp = !existingGroups.includes(groupKey);

    setFormData({
      name: primary.name || groupKey,
      category: primary.category || 'Lunch',
      groupName: isCustomGrp ? 'CUSTOM' : groupKey,
      customGroup: isCustomGrp ? groupKey : '',
      prepTime: String(primary.prepTime ?? '10'),
      description: primary.description || '',
      stock: String(primary.stock ?? '50'),
      isAvailable: primary.isAvailable !== false && primary.isActive !== false,
      imageUrl: primary.imageUrl || '',
      variants: variantsList.map(v => ({
        id: v.id,
        unit: PRESET_UNITS.includes(v.unit) ? v.unit : 'CUSTOM',
        customUnit: PRESET_UNITS.includes(v.unit) ? '' : v.unit,
        price: String(v.price ?? ''),
      }))
    });

    setImageMode(primary.imageUrl && !primary.imageUrl.startsWith('data:') ? 'url' : 'file');
    setCustomCategory('');
    setImagePreview(primary.imageUrl || null);
    setPendingBase64(null);
    setImageError('');
    setShowItemModal(true);
  };

  const handleOpenEditSingleVariant = (variantItem) => {
    const groupKey = variantItem.groupName || variantItem.name;
    const isCustomGrp = !existingGroups.includes(groupKey);

    setFormData({
      name: variantItem.name || groupKey,
      category: variantItem.category || 'Lunch',
      groupName: isCustomGrp ? 'CUSTOM' : groupKey,
      customGroup: isCustomGrp ? groupKey : '',
      prepTime: String(variantItem.prepTime ?? '10'),
      description: variantItem.description || '',
      stock: String(variantItem.stock ?? '50'),
      isAvailable: variantItem.isAvailable !== false && variantItem.isActive !== false,
      imageUrl: variantItem.imageUrl || '',
      variants: [
        {
          id: variantItem.id,
          unit: PRESET_UNITS.includes(variantItem.unit) ? variantItem.unit : 'CUSTOM',
          customUnit: PRESET_UNITS.includes(variantItem.unit) ? '' : (variantItem.unit || ''),
          price: String(variantItem.price ?? ''),
        }
      ]
    });

    setImageMode(variantItem.imageUrl && !variantItem.imageUrl.startsWith('data:') ? 'url' : 'file');
    setCustomCategory('');
    setImagePreview(variantItem.imageUrl || null);
    setPendingBase64(null);
    setImageError('');
    setShowItemModal(true);
  };

  // Variant array manipulation
  const handleAddVariantRow = () => {
    setFormData(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        { id: null, unit: '500 gm', customUnit: '', price: '' }
      ]
    }));
  };

  const handleRemoveVariantRow = (index) => {
    if (formData.variants.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const handleVariantChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImageError('');
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      const msg = 'Invalid file format. Only JPG, JPEG, PNG, and WEBP formats are supported.';
      setImageError(msg);
      if (showToast) showToast(msg, 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      const msg = 'File size exceeds maximum allowed limit of 5MB.';
      setImageError(msg);
      if (showToast) showToast(msg, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setPendingBase64(base64String);
      setImagePreview(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (urlStr) => {
    setFormData((prev) => ({ ...prev, imageUrl: urlStr }));
    setPendingBase64(null);
    setImagePreview(urlStr || null);
  };

  const handleRemoveImage = () => {
    setPendingBase64(null);
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, imageUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalImageUrl = formData.imageUrl;

      if (pendingBase64) {
        const uploadRes = await api.post('/menu/upload-image', {
          imageBase64: pendingBase64,
        });
        finalImageUrl = uploadRes.data.imageUrl;
      }

      const effectiveCategory = formData.category === 'CUSTOM' ? customCategory.trim() : formData.category.trim();
      const effectiveGroupName = formData.groupName === 'CUSTOM'
        ? formData.customGroup.trim()
        : (formData.groupName || formData.name.trim());
      const effectiveName = formData.name.trim() || effectiveGroupName;

      // Process all variant entries in parallel or sequence
      const promises = formData.variants.map(async (v) => {
        const effectiveUnit = v.unit === 'CUSTOM' ? v.customUnit.trim() : v.unit;
        const payload = {
          name: effectiveName,
          category: effectiveCategory,
          price: parseFloat(v.price),
          unit: effectiveUnit || '1 No.',
          groupName: effectiveGroupName,
          prepTime: parseInt(formData.prepTime, 10) || 10,
          description: formData.description?.trim() || null,
          stock: parseInt(formData.stock, 10) || 50,
          isActive: formData.isAvailable,
          imageUrl: finalImageUrl || null,
        };

        if (v.id) {
          return api.put(`/menu/${v.id}`, payload);
        } else {
          return api.post('/menu', payload);
        }
      });

      await Promise.all(promises);

      if (showToast) showToast(`Saved "${effectiveGroupName}" with ${formData.variants.length} variant(s)!`);

      setShowItemModal(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Save menu item error:', err);
      if (showToast) showToast(err.response?.data?.error || 'Failed to save menu items.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      const nextState = !(item.isAvailable !== false && item.isActive !== false);
      await api.put(`/menu/${item.id}`, {
        isActive: nextState,
      });
      if (showToast) showToast(`"${item.name}" availability updated to ${nextState ? 'Available' : 'Unavailable'}!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to update availability', 'error');
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    try {
      await api.delete(`/menu/${deleteConfirmItem.id}`);
      if (showToast) showToast(`Menu item "${deleteConfirmItem.name}" deleted successfully!`);
      setDeleteConfirmItem(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete menu item error:', err);
      if (showToast) showToast(err.response?.data?.error || 'Failed to delete menu item.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--card-bg)]/40 border border-[var(--border-color)] p-6 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--text-main)] font-display">Menu Catalog Management</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Control pricing, dish images, preparation times, categories, and customer availability.</p>
        </div>

        <button
          onClick={() => handleOpenAdd()}
          className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Menu Item</span>
        </button>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex items-center overflow-x-auto p-1 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl gap-1 custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat ? 'bg-orange-600 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search menu item name..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
      </div>

      {/* Menu Catalog Grid — Grouped by variant */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
        {filteredGrouped.map(({ groupKey, variants }) => {
          const primaryItem = variants[0];
          const allActive = variants.every((v) => v.isAvailable !== false && v.isActive !== false);
          const someActive = variants.some((v) => v.isAvailable !== false && v.isActive !== false);

          return (
            <div
              key={groupKey}
              className={`bg-[var(--card-bg)]/40 border rounded-2xl overflow-hidden shadow-lg flex flex-col transition-all ${
                allActive ? 'border-[var(--border-color)]' : someActive ? 'border-amber-500/30' : 'border-rose-500/30 opacity-70'
              }`}
            >
              {/* Image Header */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                {primaryItem.imageUrl ? (
                  <img
                    src={resolveImageUrl(primaryItem.imageUrl)}
                    alt={groupKey}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&auto=format&fit=crop&q=80';
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] bg-slate-100 text-xs font-bold space-x-1.5">
                    <ImageIcon className="w-4 h-4 opacity-50" />
                    <span>Fallback Image</span>
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white rounded text-[9px] font-black uppercase tracking-wider">
                  {primaryItem.category || 'General'}
                </span>

                <div className="absolute top-2 right-2 flex items-center space-x-1">
                  <span className="px-2 py-0.5 bg-orange-600/90 backdrop-blur-md text-white rounded text-[9px] font-extrabold shadow-sm">
                    {variants.length} {variants.length > 1 ? 'Variants' : 'Portion'}
                  </span>
                  <button
                    onClick={() => handleOpenEditGroup(groupKey, variants)}
                    className="p-1 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded transition-all cursor-pointer"
                    title="Edit Group & All Variants"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-3 flex-1 flex flex-col">
                {/* Group Name & Description */}
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-main)]">{groupKey}</h3>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-0.5">
                    {primaryItem.description || 'Freshly prepared daily with quality ingredients.'}
                  </p>
                </div>

                {/* Prep Time & Stock of primary */}
                <div className="flex justify-between items-center text-xs text-[var(--text-muted)] border-t border-[var(--border-color)] pt-2">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                    <span>~{primaryItem.prepTime || 10} mins</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                    <span>Stock: {primaryItem.stock || 50}</span>
                  </span>
                </div>

                {/* ── Variants / Portions List ── */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
                      {variants.length > 1 ? 'Portions / Variants' : 'Portion'}
                    </p>
                    <button
                      onClick={() => handleOpenAdd(groupKey)}
                      className="text-[10px] font-extrabold text-orange-400 hover:text-orange-300 flex items-center space-x-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Portion</span>
                    </button>
                  </div>

                  {variants.map((v) => {
                    const isVActive = v.isAvailable !== false && v.isActive !== false;
                    return (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          isVActive
                            ? 'bg-[var(--bg-color)] border-[var(--border-color)]'
                            : 'bg-rose-500/5 border-rose-500/20 opacity-70'
                        }`}
                      >
                        {/* Left: Unit + Price */}
                        <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                          <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-md text-[10px] font-bold shrink-0">
                            {v.unit || '1 No.'}
                          </span>
                          <span className="text-sm font-mono font-extrabold text-emerald-400 shrink-0">
                            Rs. {v.price?.toFixed(0)}
                          </span>
                          {!isVActive && (
                            <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">OFF</span>
                          )}
                        </div>
                        {/* Right: Actions */}
                        <div className="flex items-center space-x-1 shrink-0 ml-2">
                          <button
                            onClick={() => handleToggleAvailability(v)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              isVActive
                                ? 'text-emerald-400 hover:bg-emerald-500/10'
                                : 'text-rose-400 hover:bg-rose-500/10'
                            }`}
                            title={isVActive ? 'Disable' : 'Enable'}
                          >
                            {isVActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleOpenEditSingleVariant(v)}
                            className="p-1.5 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all cursor-pointer"
                            title="Edit Variant"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmItem(v)}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                            title="Delete Variant"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Item Modal — Portal to document.body for true screen centering */}
      {showItemModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full shadow-2xl animate-scale-up max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header — Fixed Top */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-[var(--border-color)] shrink-0 bg-[var(--card-bg)] z-10">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--text-main)] font-display">
                    {formData.variants.some(v => v.id) ? 'Edit Dish & Portions' : 'Add New Dish / Variants'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Configure item group, image, preparation time, and multiple size portions.</p>
                </div>
              </div>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1.5 rounded-xl bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar text-xs">
              {/* IMAGE MANAGEMENT SECTION */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block font-bold text-[var(--text-muted)] uppercase text-[10px]">Dish Image</label>
                  <div className="flex bg-[var(--bg-color)] p-0.5 rounded-lg border border-[var(--border-color)]">
                    <button
                      type="button"
                      onClick={() => { setImageMode('url'); setPendingBase64(null); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${imageMode === 'url' ? 'bg-orange-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                    >
                      Image URL
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImageMode('file'); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${imageMode === 'file' ? 'bg-orange-600 text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                    >
                      Upload File
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg-color)] rounded-xl border border-[var(--border-color)] space-y-2">
                  {imagePreview && (
                    <div className="relative h-28 w-full rounded-lg overflow-hidden border border-[var(--border-color)] group">
                      <img src={resolveImageUrl(imagePreview) || imagePreview} alt="Dish Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="px-2.5 py-1 bg-rose-600 text-white rounded-md text-[10px] font-bold shadow-md cursor-pointer flex items-center space-x-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove Image</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {imageMode === 'url' ? (
                    <div>
                      <input
                        type="url"
                        value={formData.imageUrl || ''}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="w-full px-3 py-1.5 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  ) : (
                    <div className="py-2 border border-dashed border-[var(--border-color)] rounded-lg text-center flex items-center justify-center space-x-3">
                      <ImageIcon className="w-4 h-4 text-[var(--text-muted)] opacity-60" />
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">Select JPG/PNG/WEBP</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-[11px] cursor-pointer shadow-sm inline-flex items-center space-x-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Browse...</span>
                      </button>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageFileChange}
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                  />

                  {imageError && (
                    <p className="text-rose-400 font-bold text-[10px] flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{imageError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* ITEM NAME & CATEGORY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase text-[10px] mb-1">Dish / Item Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Chicken Biryani"
                    className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase text-[10px] mb-1">Category *</label>
                  <select
                    value={formData.category === 'CUSTOM' || !['Lunch', 'Breakfast', 'Fast Food', 'Refreshment', 'Burgers', 'Pizza', 'Beverages'].includes(formData.category) ? 'CUSTOM' : formData.category}
                    onChange={(e) => {
                      if (e.target.value === 'CUSTOM') {
                        setCustomCategory(formData.category !== 'CUSTOM' ? formData.category : '');
                        setFormData({ ...formData, category: 'CUSTOM' });
                      } else {
                        setFormData({ ...formData, category: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer font-bold"
                  >
                    {['Lunch', 'Breakfast', 'Fast Food', 'Refreshment', 'Burgers', 'Pizza', 'Beverages'].map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="CUSTOM">+ Custom Category...</option>
                  </select>
                  {(formData.category === 'CUSTOM' || !['Lunch', 'Breakfast', 'Fast Food', 'Refreshment', 'Burgers', 'Pizza', 'Beverages'].includes(formData.category)) && (
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => {
                        setCustomCategory(e.target.value);
                        setFormData((prev) => ({ ...prev, category: e.target.value }));
                      }}
                      placeholder="Enter custom category"
                      className="w-full mt-1.5 px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                    />
                  )}
                </div>
              </div>

              {/* GROUP SELECTION (Dropdown of existing groups + Custom option) */}
              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase text-[10px] mb-1">Group Name (Select Existing or New) *</label>
                <select
                  value={formData.groupName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      groupName: val,
                      customGroup: val === 'CUSTOM' ? prev.customGroup : ''
                    }));
                  }}
                  className="w-full px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer font-bold"
                >
                  <option value="">Same as Item Name ({formData.name || 'Default'})</option>
                  {existingGroups.map((grp) => (
                    <option key={grp} value={grp}>{grp}</option>
                  ))}
                  <option value="CUSTOM">+ Custom Group Name...</option>
                </select>

                {formData.groupName === 'CUSTOM' && (
                  <input
                    type="text"
                    required
                    value={formData.customGroup}
                    onChange={(e) => setFormData(prev => ({ ...prev, customGroup: e.target.value }))}
                    placeholder="Enter brand new group name (e.g. Paratha Special)"
                    className="w-full mt-1.5 px-3 py-2 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                  />
                )}
              </div>

              {/* ── MULTI-VARIANT / PORTION SECTION ── */}
              <div className="p-3 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-extrabold text-[var(--text-main)] uppercase tracking-wider text-[10px]">Portions & Pricing (Variants)</h4>
                    <p className="text-[9px] text-[var(--text-muted)]">Add multiple sizes / portions in one card.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="px-2.5 py-1 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Portion</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.variants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg">
                      {/* Portion/Unit Selection */}
                      <div className="flex-1 space-y-0.5">
                        <select
                          value={v.unit}
                          onChange={(e) => handleVariantChange(idx, 'unit', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded text-xs font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500 cursor-pointer"
                        >
                          {PRESET_UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                          <option value="CUSTOM">+ Custom Portion...</option>
                        </select>
                        {v.unit === 'CUSTOM' && (
                          <input
                            type="text"
                            required
                            value={v.customUnit}
                            onChange={(e) => handleVariantChange(idx, 'customUnit', e.target.value)}
                            placeholder="e.g. 300 gm or Quarter"
                            className="w-full mt-1 px-2.5 py-1 bg-[var(--bg-color)] border border-[var(--border-color)] rounded text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                          />
                        )}
                      </div>

                      {/* Price */}
                      <div className="w-28 sm:w-32 space-y-0.5">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={v.price}
                          onChange={(e) => handleVariantChange(idx, 'price', e.target.value)}
                          placeholder="Price (Rs.)"
                          className="w-full px-2.5 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded text-xs font-mono font-bold text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      {/* Remove Button */}
                      {formData.variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantRow(idx)}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-md transition-all cursor-pointer shrink-0"
                          title="Remove Portion"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Prep Time & Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase text-[10px] mb-1">Prep Time (mins)</label>
                  <input
                    type="number"
                    value={formData.prepTime}
                    onChange={(e) => setFormData({ ...formData, prepTime: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text-muted)] uppercase text-[10px] mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-[var(--text-muted)] uppercase text-[10px] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short product description..."
                  className="w-full px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Availability Checkbox */}
              <div className="flex items-center space-x-2 pt-0.5">
                <input
                  type="checkbox"
                  id="availCheckAdmin"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  className="w-4 h-4 rounded text-orange-600 cursor-pointer"
                />
                <label htmlFor="availCheckAdmin" className="font-bold text-[var(--text-main)] cursor-pointer text-xs">
                  Available for Customer Ordering
                </label>
              </div>

              {/* Modal Sticky Footer — Always Visible at Bottom */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-[var(--border-color)] bg-[var(--card-bg)] sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-color)] text-[var(--text-muted)] font-bold hover:text-[var(--text-main)] cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer flex items-center space-x-1.5 text-xs"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Saving...' : `Save ${formData.variants.length > 1 ? `${formData.variants.length} Portions` : 'Item'}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal — Portal to document.body */}
      {deleteConfirmItem && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scale-up text-center my-auto">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[var(--text-main)] font-display">Delete Menu Item?</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                Are you sure you want to delete <strong className="text-[var(--text-main)]">{deleteConfirmItem.name} ({deleteConfirmItem.unit})</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-color)]">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="py-2.5 bg-[var(--bg-color)] hover:bg-[var(--border-color)] text-[var(--text-muted)] font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminMenuView;


