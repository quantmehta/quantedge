import React from 'react';

export const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => {
    return (
        <div className="group relative flex items-center justify-center">
            {children}
            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center">
                <span className="relative z-10 p-2 text-xs text-white bg-slate-800 rounded shadow-lg whitespace-nowrap">
                    {text}
                </span>
                <div className="w-3 h-3 -mt-2 bg-slate-800 rotate-45"></div>
            </div>
        </div>
    );
};
