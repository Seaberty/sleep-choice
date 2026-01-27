"use client";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="bg-slate-50 py-20 px-4 text-center lg:text-left lg:py-32">
      <div className="container mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 lg:text-7xl mb-6">
            Find Your <span className="text-blue-600">Perfect Night</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            Data-backed reviews and personalized recommendations. We test the latest sleep tech so you don't have to.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <button className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold hover:bg-blue-700 transition-all">
              Start Sleep Quiz
            </button>
            <button className="bg-white border border-slate-200 px-8 py-4 rounded-full font-bold hover:bg-slate-50">
              Browse All Reviews
            </button>
          </div>
        </motion.div>
        
        {/* Placeholder for AI Visualization or Product Shot */}
        <div className="hidden lg:block relative h-[400px] bg-slate-200 rounded-3xl overflow-hidden shadow-inner">
           <div className="absolute inset-0 flex items-center justify-center text-slate-400">
             [Dynamic Product Visualization]
           </div>
        </div>
      </div>
    </section>
  );
}