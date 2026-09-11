import { createElement, type ImgHTMLAttributes } from 'react';

export default function Image({
  unoptimized: _unoptimized,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
  return createElement('img', props);
}
