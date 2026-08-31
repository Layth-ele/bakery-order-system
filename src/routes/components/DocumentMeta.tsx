/**
 * DocumentMeta.tsx
 * Component for managing document metadata
 * 
 * Features:
 * - Sets meta tags for SEO
 * - Updates document title
 * - Manages Open Graph tags
 * - Responsive to route changes
 */

import { useEffect } from 'react';
import { useMatches } from 'react-router';

interface MetaConfig {
  title?: string;
  description?: string;
  keywords?: string[];
  author?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
}

interface RouteMatch {
  id: string;
  pathname: string;
  handle?: {
    meta?: MetaConfig | ((data?: any) => MetaConfig);
  };
  data?: any;
}

const DEFAULT_META: MetaConfig = {
  title: 'Bakery Order Management',
  description: 'Premium bakery order management system with delivery scheduling and customer management',
  keywords: ['bakery', 'order management', 'delivery', 'scheduling'],
  author: 'Bakery Order Management System',
  ogType: 'website',
};

/**
 * Sets a meta tag in the document head
 */
function setMetaTag(name: string, content: string, useProperty = false) {
  const attribute = useProperty ? 'property' : 'name';
  let element = document.querySelector(`meta[${attribute}="${name}"]`);
  
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  
  element.setAttribute('content', content);
}

/**
 * Removes a meta tag from the document head
 */
function removeMetaTag(name: string, useProperty = false) {
  const attribute = useProperty ? 'property' : 'name';
  const element = document.querySelector(`meta[${attribute}="${name}"]`);
  if (element) {
    element.remove();
  }
}

/**
 * Component that manages document metadata based on route configuration
 */
export function DocumentMeta(): JSX.Element | null {
  const matches = useMatches() as RouteMatch[];
  
  useEffect(() => {
    // Find the deepest route with meta configuration
    const metaRoute = [...matches].reverse().find(match => match.handle?.meta);
    
    let meta: MetaConfig = DEFAULT_META;
    
    if (metaRoute?.handle?.meta) {
      const routeMeta = typeof metaRoute.handle.meta === 'function'
        ? metaRoute.handle.meta(metaRoute.data)
        : metaRoute.handle.meta;
      
      meta = { ...DEFAULT_META, ...routeMeta };
    }
    
    // Set document title
    if (meta.title) {
      document.title = meta.title.includes('Bakery Order Management')
        ? meta.title
        : `${meta.title} | Bakery Order Management`;
    }
    
    // Set meta description
    if (meta.description) {
      setMetaTag('description', meta.description);
    }
    
    // Set meta keywords
    if (meta.keywords && meta.keywords.length > 0) {
      setMetaTag('keywords', meta.keywords.join(', '));
    }
    
    // Set author
    if (meta.author) {
      setMetaTag('author', meta.author);
    }
    
    // Set Open Graph tags
    if (meta.ogTitle) {
      setMetaTag('og:title', meta.ogTitle, true);
    }
    
    if (meta.ogDescription) {
      setMetaTag('og:description', meta.ogDescription, true);
    }
    
    if (meta.ogImage) {
      setMetaTag('og:image', meta.ogImage, true);
    }
    
    if (meta.ogType) {
      setMetaTag('og:type', meta.ogType, true);
    }
    
    // Cleanup function
    return () => {
      // Reset to defaults on unmount
      document.title = DEFAULT_META.title || 'Bakery Order Management';
    };
  }, [matches]);
  
  return null;
}

/**
 * Hook version for components that need to set metadata imperatively
 */
export function useDocumentMeta(meta: MetaConfig) {
  useEffect(() => {
    const previousTitle = document.title;
    
    // Set document title
    if (meta.title) {
      document.title = meta.title.includes('Bakery Order Management')
        ? meta.title
        : `${meta.title} | Bakery Order Management`;
    }
    
    // Set meta description
    if (meta.description) {
      setMetaTag('description', meta.description);
    }
    
    // Set meta keywords
    if (meta.keywords && meta.keywords.length > 0) {
      setMetaTag('keywords', meta.keywords.join(', '));
    }
    
    // Set author
    if (meta.author) {
      setMetaTag('author', meta.author);
    }
    
    // Set Open Graph tags
    if (meta.ogTitle) {
      setMetaTag('og:title', meta.ogTitle, true);
    }
    
    if (meta.ogDescription) {
      setMetaTag('og:description', meta.ogDescription, true);
    }
    
    if (meta.ogImage) {
      setMetaTag('og:image', meta.ogImage, true);
    }
    
    if (meta.ogType) {
      setMetaTag('og:type', meta.ogType, true);
    }
    
    // Cleanup
    return () => {
      document.title = previousTitle;
    };
  }, [meta]);
}

/**
 * Utility to create consistent meta configurations
 */
export function createMetaConfig(config: Partial<MetaConfig>): MetaConfig {
  return {
    ...DEFAULT_META,
    ...config,
    ogTitle: config.ogTitle || config.title,
    ogDescription: config.ogDescription || config.description,
  };
}
