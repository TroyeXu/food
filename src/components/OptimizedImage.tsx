'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill' | 'scale-down';
  objectPosition?: string;
  onLoad?: () => void;
}

/**
 * 優化的圖片元件，支援：
 * - Next.js 圖片優化
 * - 懶加載（預設）
 * - 模糊效果過渡
 * - WebP 格式支援
 * - 響應式尺寸
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 400,
  height = 300,
  className = '',
  priority = false,
  fill = false,
  objectFit = 'cover',
  objectPosition = 'center',
  onLoad,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setIsError(true);
  };

  // 如果圖片加載失敗，使用佔位符
  const imageSrc = isError ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0"/%3E%3C/svg%3E' : src;

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        quality={75}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        style={{
          objectFit,
          objectPosition,
          transition: isLoaded ? 'opacity 300ms ease-out' : 'none',
          opacity: isLoaded ? 1 : 0.8,
        }}
        onLoadingComplete={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
