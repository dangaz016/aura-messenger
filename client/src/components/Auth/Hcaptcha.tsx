import { useEffect, useRef } from 'react';

export function Hcaptcha() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  
  return (
    <div ref={containerRef} className="h-captcha" data-sitekey="your-site-key"></div>
  );
}