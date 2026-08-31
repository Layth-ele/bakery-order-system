/**
 * EditCategoryModal - Add or edit product categories
 * 
 * ✅ FEB 20, 2026: Recreated after accidental deletion during modal organization
 * 
 * Allows:
 * - Creating new categories
 * - Editing existing category names
 * - Setting category display order
 */

import React, { useState } from 'react';
import {Folder, Hash} from 'lucide-react'
import { StyleModalShell } from '../../../ui/modals/StyleModalShell'; // Fixed broken import path
import { Category } from '../../../types';

interface EditCategoryModalProps {
  category?: Category | null;
  categoryCount?: number;
  onSave: (categoryData: { name: string; order: number }, isEditing: boolean, categoryId?: string) => void;
  onCancel: () => void;
  onClose: () => void;
}

export function EditCategoryModal({
  category,
  categoryCount = 0,
  onSave,
  onCancel,
  onClose,
}: EditCategoryModalProps): JSX.Element | null {
  const isEditing = !!category;
  
  const [formData, setFormData] = useState({
    name: category?.name || '',
    order: category?.order?.toString() || (categoryCount + 1).toString(),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    }

    const order = parseInt(formData.order);
    if (isNaN(order) || order < 1) {
      newErrors.order = 'Please enter a valid order number (1 or greater)';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // ✅ Build category data with id when editing
    const categoryData: any = {
      name: formData.name.trim(),
      order: parseInt(formData.order),
    };
    
    // Add id when editing
    if (isEditing && category?.id) {
      categoryData.id = category.id;
    }

    onSave(categoryData, isEditing, category?.id);
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <StyleModalShell
      width="4xl"
      skinType="default"
 
      onClose={handleCancel} 
      title={isEditing ? "EDIT CATEGORY" : "ADD NEW CATEGORY"}
      subtitle={isEditing && category ? category.name : "Manage product categories"}
      icon={<Folder className="w-5 h-5 sm:w-6 sm:h-6" />}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Category Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., Pastries, Breads, Desserts"
            autoFocus
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Display Order */}
        <div>
          <label htmlFor="order" className="block text-sm font-medium text-gray-700 mb-2">
            Display Order *
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="number"
              id="order"
              value={formData.order}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, order: e.target.value })}
              min="1"
              step="1"
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#D4A574] focus:border-transparent ${
                errors.order ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="1"
            />
          </div>
          {errors.order && (
            <p className="mt-1 text-sm text-red-600">{errors.order}</p>
          )}
          <p className="mt-2 text-sm text-gray-600">
            Lower numbers appear first in the product list
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            {isEditing ? (
              <>
                Editing the category name will update it for all products in this category.
              </>
            ) : (
              <>
                After creating this category, you can assign products to it from the Manage Products page.
              </>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#D4A574] to-[#C5A028] text-white rounded-lg hover:from-[#C5A028] hover:to-[#B39120] transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
          >
            {isEditing ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </form>
    </StyleModalShell>
  );
}