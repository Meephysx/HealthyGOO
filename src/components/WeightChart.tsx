import React from 'react';
import { motion } from 'framer-motion';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Scale, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface WeightData {
  date: string;
  weight: number;
}

interface WeightChartProps {
  data: WeightData[];
  targetWeight?: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 shadow-xl rounded-xl border border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          {new Date(payload[0].payload.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
        </p>
        <p className="text-sm font-black text-gray-900">
          {payload[0].value} <span className="text-gray-400 font-medium text-xs">kg</span>
        </p>
      </div>
    );
  }
  return null;
};

const WeightChart: React.FC<WeightChartProps> = ({ data, targetWeight }) => {
  const latestWeight = data.length > 0 ? data[data.length - 1].weight : 0;
  const previousWeight = data.length > 1 ? data[data.length - 2].weight : latestWeight;
  const diff = latestWeight - previousWeight;

  // Calculate Y-Axis domain to "zoom in" on the weight range
  const weights = data.map(d => d.weight);
  const minW = Math.min(...weights, targetWeight || Infinity) - 2;
  const maxW = Math.max(...weights, targetWeight || -Infinity) + 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Scale size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Tren Berat</h3>
            <p className="text-sm text-gray-500 font-medium">7 entri terakhir</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saat ini</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-gray-900">{latestWeight}kg</span>
              {diff !== 0 ? (
                <div className={`flex items-center text-xs font-bold ${diff > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(diff).toFixed(1)}
                </div>
              ) : (
                <Minus size={14} className="text-gray-300" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-[280px] w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                tickFormatter={(str) => new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                dy={10}
              />
              <YAxis 
                domain={[Math.floor(minW), Math.ceil(maxW)]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#10b981"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorWeight)"
                animationDuration={2000}
                isAnimationActive={true}
              />
              {targetWeight && (
                <Area
                  type="monotone"
                  dataKey={() => targetWeight}
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
             <Scale className="text-gray-200 mb-2" size={48} />
             <p className="text-gray-400 text-sm font-medium">Belum ada data</p>
          </div>
        )}
      </div>
      
      <div className="mt-6 flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-1 bg-emerald-500 rounded-full" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{latestWeight}kg</span>
        </div>
        {targetWeight && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-gray-300 rounded-full border-dashed border" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target: {targetWeight}kg</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default WeightChart;