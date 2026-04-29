import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function Card({ children, className, title, subtitle, variant = 'default', action }) {
  const variants = {
    default: 'bento-card',
    dark: 'bento-card-dark',
    accent: 'bento-card-accent',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(variants[variant], className)}
    >
      {(title || subtitle || action) && (
        <div className="mb-6 flex justify-between items-start">
          <div>
            {title && <h3 className={cn("text-xl font-bold tracking-tight", variant === 'default' ? 'text-slate-900' : 'text-white')}>{title}</h3>}
            {subtitle && <p className={cn("text-xs font-bold uppercase tracking-widest mt-1", variant === 'default' ? 'text-slate-500' : 'text-indigo-200')}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </motion.div>
  );
}

export function Button(props) {
  const { 
    children, 
    variant = 'primary', 
    size = 'md', 
    isLoading, 
    className, 
    ...otherProps 
  } = props;
  
  const variants = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-500',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-300',
    outline: 'bg-transparent border border-slate-200 text-slate-900 hover:bg-slate-50 focus:ring-slate-500',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-300',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-200',
    brand: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-bold uppercase tracking-wider',
    md: 'px-4 py-2.5 text-sm font-semibold',
    lg: 'px-8 py-4 text-base font-bold tracking-tight',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={isLoading || otherProps.disabled}
      {...otherProps}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      )}
      {children}
    </button>
  );
}

export function Badge({ children, variant = 'secondary', className }) {
  const variants = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    danger: 'bg-rose-50 text-rose-600 border-rose-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    secondary: 'bg-slate-100 text-slate-500 border-slate-200',
    brand: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    staff: 'bg-purple-50 text-purple-600 border-purple-100', // For TU
    class: 'bg-sky-50 text-sky-600 border-sky-100', // For Bendahara Kelas
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
