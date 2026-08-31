/**
 * EditProductModal - Create or edit product details
 *
 * ✅ FEB 23, 2026: CORRECTED - product is OPTIONAL (undefined when creating new product)
 * ✅ FEB 23, 2026: CORRECTED - Uses retail/wholesale/cost (NOT price or available)
 * ✅ FEB 23, 2026: CORRECTED - Uses onCancel (NOT onClose)
 * ✅ MAR 18, 2026: ADDED - Firebase Storage image upload with progress tracking
 * ✅ MAR 28, 2026: ADDED - Allergens, dietary labels, nutrition info (all optional)
 */

import type { UploadProgress } from '../../../services/firebase/storageService';
import React, { useState, useRef } from 'react';
import { DollarSign, Tag, Edit, Plus, Upload, X, AlertCircle, Leaf, Flame } from 'lucide-react';
import { ProductImagePlaceholder } from '../../shared/ProductImagePlaceholder';
import { StyleModalShell } from '../../../ui/modals/StyleModalShell';
import { Product, Category } from '../../../types';
import { uploadProductImage, validateImageFile } from '../../../services/firebase/storageService';
import { isFirebaseConfigured } from '../../../firebase/config';

// ── Allergen / dietary constants (mirrors ProductDetailsModal) ──────────────
const COMMON_ALLERGENS = [
  { id: 'wheat',     label: 'Wheat',     icon: '🌾' },
  { id: 'milk',      label: 'Dairy',     icon: '🥛' },
  { id: 'eggs',      label: 'Eggs',      icon: '🥚' },
  { id: 'nuts',      label: 'Tree Nuts', icon: '🌰' },
  { id: 'peanuts',   label: 'Peanuts',   icon: '🥜' },
  { id: 'soy',       label: 'Soy',       icon: '🫘' },
  { id: 'fish',      label: 'Fish',      icon: '🐟' },
  { id: 'shellfish', label: 'Shellfish', icon: '🦐' },
];

const DIETARY_LABELS = [
  { id: 'vegan',       label: 'Vegan',       icon: '🌱' },
  { id: 'vegetarian',  label: 'Vegetarian',  icon: '🥗' },
  { id: 'gluten-free', label: 'Gluten Free', icon: '✦'  },
  { id: 'dairy-free',  label: 'Dairy Free',  icon: '✦'  },
  { id: 'organic',     label: 'Organic',     icon: '♻️' },
  { id: 'low-sugar',   label: 'Low Sugar',   icon: '✦'  },
];

interface NutritionForm {
  servingSize: string;
  calories:    string;
  protein:     string;
  carbs:       string;
  fat:         string;
  fiber:       string;
  sugar:       string;
  sodium:      string;
}

const emptyNutrition = (): NutritionForm => ({
  servingSize: '', calories: '', protein: '',
  carbs: '', fat: '', fiber: '', sugar: '', sodium: '',
});

interface ProductFormData {
  id: string; name: string; categoryId: string;
  cost: string; retail: string; wholesale: string;
  minQty: string; dailyMinOrder: string; discount: string;
  image: string; description: string; ingredients: string;
  storageDescription: string; shelfLife: string;
  allergens: string[];
  dietary: string[];
  hasNutrition: boolean;
  nutrition: NutritionForm;
}

interface EditProductModalProps {
  product?: Product;
  categories: Category[];
  onSave: (productData: any, isEditing: boolean) => void;
  onCancel: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const inputCls = (err?: string) =>
  `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent text-sm ${
    err ? 'border-red-500' : 'border-gray-300'
  }`;

const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

export function EditProductModal({
  product, categories, onSave, onCancel,
}: EditProductModalProps): JSX.Element | null {
  const isEditing = !!product;
  const p = product as any;

  // Initialise nutrition from existing product data
  const initNutrition = (): NutritionForm => {
    if (!p?.nutrition) return emptyNutrition();
    const n = p.nutrition;
    return {
      servingSize: n.servingSize ?? '',
      calories:    n.calories?.toString() ?? '',
      protein:     n.protein?.toString()  ?? '',
      carbs:       n.carbs?.toString()    ?? '',
      fat:         n.fat?.toString()      ?? '',
      fiber:       n.fiber?.toString()    ?? '',
      sugar:       n.sugar?.toString()    ?? '',
      sodium:      n.sodium?.toString()   ?? '',
    };
  };

  const [formData, setFormData] = useState<ProductFormData>({
    id:                 product?.id              || '',
    name:               product?.name            || '',
    categoryId:         product?.categoryId      || (categories[0]?.id ?? ''),
    cost:               product?.cost?.toString()         || '',
    retail:             product?.retail?.toString()       || '',
    wholesale:          product?.wholesale?.toString()    || '',
    minQty:             product?.minQty?.toString()       || '',
    dailyMinOrder:      product?.dailyMinOrder?.toString()|| '',
    discount:           product?.discount?.toString()     || '',
    image:              product?.image           || '',
    description:        product?.description     || '',
    ingredients:        product?.ingredients     || '',
    storageDescription: product?.storageDescription || '',
    shelfLife:          product?.shelfLife        || '',
    allergens:          p?.allergens  ?? [],
    dietary:            p?.dietary    ?? [],
    hasNutrition:       !!p?.nutrition,
    nutrition:          initNutrition(),
  });

  const [errors,         setErrors]         = useState<Record<string, string>>({});
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadError,    setUploadError]    = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof ProductFormData, val: any) =>
    setFormData(prev => ({ ...prev, [key]: val }));

  const setNut = (key: keyof NutritionForm, val: string) =>
    setFormData(prev => ({ ...prev, nutrition: { ...prev.nutrition, [key]: val } }));

  const toggleAllergen = (id: string) => {
    setFormData(prev => ({
      ...prev,
      allergens: prev.allergens.includes(id)
        ? prev.allergens.filter(a => a !== id)
        : [...prev.allergens, id],
    }));
  };

  const toggleDietary = (id: string) => {
    setFormData(prev => ({
      ...prev,
      dietary: prev.dietary.includes(id)
        ? prev.dietary.filter(d => d !== id)
        : [...prev.dietary, id],
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      validateImageFile(file);
      setSelectedFile(file);
      setUploadError('');
      const reader = new FileReader();
      reader.onload = ev => set('image', ev.target?.result as string);
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadError((err as any).message || 'Invalid file');
      setSelectedFile(null);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    set('image', '');
    setUploadError('');
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!formData.name.trim())          errs.name = 'Product name is required';
    if (!formData.categoryId)           errs.categoryId = 'Please select a category';
    const cost = parseFloat(formData.cost);
    if (!formData.cost || isNaN(cost) || cost < 0) errs.cost = 'Valid cost required';
    const retail = parseFloat(formData.retail);
    if (!formData.retail || isNaN(retail) || retail < 0) errs.retail = 'Valid retail price required';
    const wholesale = parseFloat(formData.wholesale);
    if (!formData.wholesale || isNaN(wholesale) || wholesale < 0) errs.wholesale = 'Valid wholesale price required';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    try {
      setIsUploading(true);
      setUploadError('');
      let imageUrl = formData.image;

      if (selectedFile && isFirebaseConfigured) {
        const productId = formData.id || `temp_${Date.now()}`;
        imageUrl = await uploadProductImage(selectedFile, productId,
          (prog: UploadProgress) => setUploadProgress(prog.percentage));
      }

      // Build nutrition object only if enabled
      const nutritionData = formData.hasNutrition ? {
        servingSize: formData.nutrition.servingSize || undefined,
        calories:    formData.nutrition.calories    ? parseFloat(formData.nutrition.calories)    : undefined,
        protein:     formData.nutrition.protein     ? parseFloat(formData.nutrition.protein)     : undefined,
        carbs:       formData.nutrition.carbs       ? parseFloat(formData.nutrition.carbs)       : undefined,
        fat:         formData.nutrition.fat         ? parseFloat(formData.nutrition.fat)         : undefined,
        fiber:       formData.nutrition.fiber       ? parseFloat(formData.nutrition.fiber)       : undefined,
        sugar:       formData.nutrition.sugar       ? parseFloat(formData.nutrition.sugar)       : undefined,
        sodium:      formData.nutrition.sodium      ? parseFloat(formData.nutrition.sodium)      : undefined,
      } : undefined;

      const productData = {
        id:                 formData.id,
        name:               formData.name.trim(),
        categoryId:         formData.categoryId,
        cost:               parseFloat(formData.cost),
        retail:             parseFloat(formData.retail),
        wholesale:          parseFloat(formData.wholesale),
        minQty:             parseFloat(formData.minQty) || 0,
        dailyMinOrder:      parseFloat(formData.dailyMinOrder) || 0,
        discount:           parseFloat(formData.discount) || 0,
        image:              imageUrl.trim(),
        description:        formData.description.trim(),
        ingredients:        formData.ingredients.trim(),
        storageDescription: formData.storageDescription.trim(),
        shelfLife:          formData.shelfLife.trim(),
        allergens:          formData.allergens.length > 0 ? formData.allergens : undefined,
        dietary:            formData.dietary.length   > 0 ? formData.dietary   : undefined,
        nutrition:          nutritionData,
      };

      onSave(productData as any, isEditing);
      onCancel();
    } catch (err) {
      console.error('❌ Failed to save product:', err);
      setUploadError((err as any).message || 'Failed to save product');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
      onClose={onCancel}
      title={isEditing ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}
      subtitle={isEditing ? (product?.name || '') : 'Create a new product'}
      icon={isEditing ? <Edit className="w-5 h-5 sm:w-6 sm:h-6" /> : <Plus className="w-5 h-5 sm:w-6 sm:h-6" />}
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Product Name ──────────────────────────────────── */}
        <div>
          <label htmlFor="name" className={labelCls}>Product Name *</label>
          <input
            type="text" id="name" value={formData.name}
            onChange={e => set('name', e.target.value)}
            className={inputCls(errors.name)}
            placeholder="e.g., Chocolate Croissant"
            disabled={isUploading}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* ── Category ─────────────────────────────────────── */}
        <div>
          <label htmlFor="category" className={labelCls}>Category *</label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              id="category" value={formData.categoryId}
              onChange={e => set('categoryId', e.target.value)}
              className={`${inputCls(errors.categoryId)} pl-9 appearance-none`}
              disabled={isUploading}
            >
              <option value="">Select category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          {errors.categoryId && <p className="mt-1 text-xs text-red-600">{errors.categoryId}</p>}
        </div>

        {/* ── Pricing ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {(['cost','retail','wholesale'] as const).map(field => (
            <div key={field}>
              <label htmlFor={field} className={labelCls}>
                {field === 'cost' ? 'Cost *' : field === 'retail' ? 'Retail *' : 'Wholesale *'}
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number" id={field} value={formData[field]}
                  onChange={e => set(field, e.target.value)}
                  step="0.01" min="0"
                  className={`${inputCls(errors[field])} pl-9`}
                  placeholder="0.00" disabled={isUploading}
                />
              </div>
              {errors[field] && <p className="mt-1 text-xs text-red-600">{errors[field]}</p>}
            </div>
          ))}
        </div>

        {/* ── Additional Settings ───────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'minQty',        label: 'Min Qty',      placeholder: '1'   },
            { key: 'dailyMinOrder', label: 'Daily Min',    placeholder: '0'   },
            { key: 'discount',      label: 'Discount (%)', placeholder: '0'   },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label htmlFor={key} className={labelCls}>{label}</label>
              <input
                type="number" id={key}
                value={(formData as any)[key]}
                onChange={e => set(key as any, e.target.value)}
                step={key === 'discount' ? '1' : '1'} min="0"
                max={key === 'discount' ? '100' : undefined}
                className={inputCls()}
                placeholder={placeholder} disabled={isUploading}
              />
            </div>
          ))}
        </div>

        {/* ── Description ──────────────────────────────────── */}
        <div>
          <label htmlFor="description" className={labelCls}>Description</label>
          <textarea
            id="description" value={formData.description}
            onChange={e => set('description', e.target.value)}
            rows={2} className={`${inputCls()} resize-none`}
            placeholder="Brief product description…" disabled={isUploading}
          />
        </div>

        {/* ── Product Image ─────────────────────────────────── */}
        <div>
          <label className={labelCls}>Product Image</label>
          <div className="space-y-3">
            {/* Image preview — placeholder when none */}
            <div className="flex items-center gap-3">
              {formData.image ? (
                <div className="relative flex-shrink-0">
                  <img src={formData.image} alt="preview" className="w-24 h-24 object-cover rounded-xl border-2 border-gray-200" />
                  <button type="button" onClick={handleClearImage} disabled={isUploading}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <ProductImagePlaceholder size="md" className="w-24 h-24 flex-shrink-0" />
              )}
              <div className="text-xs text-gray-500">
                <p className="font-medium text-gray-700 mb-1">Upload a product photo</p>
                <p className="text-gray-400">JPEG, PNG, WebP or GIF · Max 5MB</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect} className="hidden" disabled={isUploading} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-[#D4A574] hover:bg-gray-50 transition-colors w-full justify-center disabled:opacity-50"
              disabled={isUploading}>
              {isUploading
                ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-[#D4A574] border-t-transparent" /><span className="text-sm text-gray-500">Uploading… {uploadProgress}%</span></>
                : <><Upload className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-500">{selectedFile ? selectedFile.name : 'Click to upload image'}</span></>}
            </button>
            {isUploading && (
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-[#D4A574] h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            {uploadError && <p className="text-xs text-red-600 flex items-center gap-1"><X className="w-3.5 h-3.5" />{uploadError}</p>}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            OPTIONAL DETAILS SECTION
        ═══════════════════════════════════════════════════ */}
        <div className="border border-[#D4A574]/30 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#f5f1eb] to-[#ede5d8] px-4 py-2.5 border-b border-[#D4A574]/20">
            <p className="text-xs font-bold text-[#8B6F47] uppercase tracking-widest">Optional Details</p>
            <p className="text-[10px] text-[#8B6F47]/60 mt-0.5">Ingredients · Storage · Allergens · Nutrition — none required</p>
          </div>
          <div className="p-4 space-y-4">

            {/* Ingredients */}
            <div>
              <label htmlFor="ingredients" className={labelCls}>Ingredients</label>
              <textarea id="ingredients" value={formData.ingredients}
                onChange={e => set('ingredients', e.target.value)}
                rows={2} className={`${inputCls()} resize-none`}
                placeholder="e.g., Flour, Butter, Sugar, Eggs…" disabled={isUploading} />
            </div>

            {/* Storage + Shelf Life */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="storageDescription" className={labelCls}>Storage Instructions</label>
                <input type="text" id="storageDescription" value={formData.storageDescription}
                  onChange={e => set('storageDescription', e.target.value)}
                  className={inputCls()} placeholder="e.g., Refrigerate after opening" disabled={isUploading} />
              </div>
              <div>
                <label htmlFor="shelfLife" className={labelCls}>Shelf Life</label>
                <input type="text" id="shelfLife" value={formData.shelfLife}
                  onChange={e => set('shelfLife', e.target.value)}
                  className={inputCls()} placeholder="e.g., 3 days" disabled={isUploading} />
              </div>
            </div>

            {/* ── Allergens ──────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <label className="text-sm font-medium text-gray-700">Contains Allergens</label>
                <span className="text-xs text-gray-400">(tap to toggle)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGENS.map(({ id, label, icon }) => {
                  const active = formData.allergens.includes(id);
                  return (
                    <button key={id} type="button" onClick={() => toggleAllergen(id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                        active
                          ? 'bg-red-100 text-red-800 border-red-300 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-red-300 hover:bg-red-50'
                      }`}>
                      <span>{icon}</span>{label}
                      {active && <span className="ml-0.5 text-red-600 font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Dietary Labels ────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-4 h-4 text-emerald-600" />
                <label className="text-sm font-medium text-gray-700">Dietary Labels</label>
                <span className="text-xs text-gray-400">(tap to toggle)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DIETARY_LABELS.map(({ id, label, icon }) => {
                  const active = formData.dietary.includes(id);
                  return (
                    <button key={id} type="button" onClick={() => toggleDietary(id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                        active
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-300 hover:bg-emerald-50'
                      }`}>
                      <span>{icon}</span>{label}
                      {active && <span className="ml-0.5 text-emerald-600 font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Nutrition Info ───────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <label className="text-sm font-medium text-gray-700">Nutritional Information</label>
                </div>
                <button type="button"
                  onClick={() => set('hasNutrition', !formData.hasNutrition)}
                  className={`text-xs px-3 py-1 rounded-full border font-semibold transition-all ${
                    formData.hasNutrition
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-white text-gray-500 border-gray-300 hover:border-amber-300'
                  }`}>
                  {formData.hasNutrition ? '✓ Enabled' : 'Add Nutrition'}
                </button>
              </div>

              {formData.hasNutrition && (
                <div className="bg-[#faf8f5] border border-[#D4A574]/20 rounded-xl p-3 space-y-3">
                  {/* Serving size */}
                  <div>
                    <label className={labelCls}>Serving Size</label>
                    <input type="text" id="servingSize" value={formData.nutrition.servingSize}
                      onChange={e => setNut('servingSize', e.target.value)}
                      className={inputCls()} placeholder="e.g., 1 piece (57g)" disabled={isUploading} />
                  </div>
                  {/* Main macros */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['calories','protein','carbs','fat'] as const).map(key => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{key}</label>
                        <input type="number" id={`nutrition-${key}`} min="0" step="0.1"
                          value={formData.nutrition[key]}
                          onChange={e => setNut(key, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
                          placeholder="0" disabled={isUploading} />
                        <p className="text-[9px] text-gray-400 mt-0.5 text-center">{key === 'calories' ? 'kcal' : 'g'}</p>
                      </div>
                    ))}
                  </div>
                  {/* Secondary nutrients */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['fiber','sugar','sodium'] as const).map(key => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{key}</label>
                        <input type="number" id={`nutrition-${key}`} min="0" step="0.1"
                          value={formData.nutrition[key]}
                          onChange={e => setNut(key, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#D4A574] focus:border-transparent"
                          placeholder="0" disabled={isUploading} />
                        <p className="text-[9px] text-gray-400 mt-0.5 text-center">{key === 'sodium' ? 'mg' : 'g'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Action Buttons ──────────────────────────────── */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button type="button" onClick={onCancel} disabled={isUploading}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={isUploading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D4A574] to-[#C5A028] text-white rounded-xl hover:from-[#C5A028] hover:to-[#B39120] shadow-md hover:shadow-lg font-medium transition-all disabled:opacity-50">
            {isUploading
              ? <span className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Uploading…</span>
              : (isEditing ? 'Save Changes' : 'Create Product')}
          </button>
        </div>

      </form>
    </StyleModalShell>
  );
}
