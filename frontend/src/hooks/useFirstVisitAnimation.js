import { useState, useEffect } from 'react';

/**
 * Hook to show animations only on first visit per session
 * @param {string} pageKey - Unique key for the page
 * @returns {boolean} - Whether to show animations
 */
export function useFirstVisitAnimation(pageKey) {
  const [showAnimations, setShowAnimations] = useState(false);
  
  useEffect(() => {
    const storageKey = `page_animated_${pageKey}`;
    const hasAnimated = sessionStorage.getItem(storageKey);
    
    if (!hasAnimated) {
      setShowAnimations(true);
      sessionStorage.setItem(storageKey, 'true');
    }
  }, [pageKey]);
  
  return showAnimations;
}

/**
 * Utility function to get animation class
 * @param {boolean} showAnimations - Whether to show animations
 * @param {string} animationClass - The animation class(es) to apply
 * @returns {string} - Animation class or empty string
 */
export function getAnimationClass(showAnimations, animationClass = 'animate-bounce-in') {
  return showAnimations ? animationClass : '';
}
