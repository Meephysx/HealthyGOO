import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, Star, User as UserIcon, Loader2, Award, Zap, History, Flame } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { getRankFromXP } from '../context/DailyLogContext';

interface LeaderboardUser {
  id: string;
  name: string;
  xp: number;
  totalXp?: number;
  rank: string;
  photoURL?: string;
  highestRank?: string;
}

const Leaderboard: React.FC = () => {
  const [seasonUsers, setSeasonUsers] = useState<LeaderboardUser[]>([]);
  const [allTimeUsers, setAllTimeUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        // Fetch Top 10 Season
        const qSeason = query(
          collection(db, 'users'),
          orderBy('xp', 'desc'),
          limit(10)
        );

        // Fetch Top 10 All-Time
        const qAllTime = query(
          collection(db, 'users'),
          orderBy('totalXp', 'desc'),
          limit(10)
        );

        const [seasonSnap, allTimeSnap] = await Promise.all([
          getDocs(qSeason),
          getDocs(qAllTime)
        ]);

        setSeasonUsers(seasonSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LeaderboardUser)));

        setAllTimeUsers(allTimeSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LeaderboardUser)));

      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0: return { icon: <Crown className="text-yellow-400 fill-yellow-400" size={24} />, bg: 'bg-yellow-500/10 border-yellow-500/50' };
      case 0: return { icon: <Crown className="text-yellow-400 fill-yellow-400" size={18} />, bg: 'bg-yellow-500/5 border-yellow-500/20' };
      case 1: return { icon: <Medal className="text-gray-300 fill-gray-300" size={18} />, bg: 'bg-gray-400/5 border-gray-400/20' };
      case 2: return { icon: <Medal className="text-amber-600 fill-amber-600" size={18} />, bg: 'bg-amber-700/5 border-amber-700/20' };
      default: return { icon: <span className="text-slate-400 font-bold w-5 text-[10px]">{index + 1}</span>, bg: 'bg-white border-gray-100' };
    }
  };

  const RenderList = ({ users, title, type }: { users: LeaderboardUser[], title: string, type: 'season' | 'allTime' }) => (
    <div className="flex-1 min-w-0">
      <div className={`flex items-center gap-2 mb-4 px-2`}>
        {type === 'season' ? <Zap className="text-emerald-500 fill-emerald-500" size={20} /> : <History className="text-purple-500" size={20} />}
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      </div>
      
      <div className="space-y-2">
        {users.length > 0 ? (
          users.map((user, index) => {
            const style = getRankStyle(index);
            const displayXP = type === 'season' ? user.xp : (user.totalXp || 0);
            const rankName = getRankFromXP(displayXP);

            return (
              <div 
                key={user.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${style.bg} hover:scale-[1.02]`}
              >
                <div className="shrink-0 w-6 flex justify-center">{style.icon}</div>
                
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-white shadow-sm shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-full h-full p-2 text-slate-300" />
                  )}
                </div>

                <div className="flex-grow min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 truncate flex items-center gap-1">
                    {user.name}
                    {type === 'allTime' && user.highestRank === 'Shadow Monarch' && <Crown size={12} className="text-purple-500 fill-purple-500" />}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{rankName}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${type === 'season' ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {displayXP.toLocaleString()}
                  </p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">XP</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-10 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs text-gray-400 font-medium">Belum ada data</p>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-emerald-500 mb-4" size={40} />
        <p className="text-gray-500 font-medium">Menyusun Hall of Fame...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 pb-32">
      <div className="max-w-6xl mx-auto px-4">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center justify-center md:justify-start gap-3">
              <Trophy className="text-yellow-500" size={40} />
              Hall of Fame
            </h1>
            <p className="text-slate-500 mt-1 font-medium italic">"Legenda tidak dilahirkan, mereka dibentuk setiap hari."</p>
          </div>
          
          <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Flame className="text-emerald-600" size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Season</p>
              <p className="text-sm font-bold text-slate-800">Season 1: The Beginning</p>
            </div>
          </div>
        </div>

        {/* Main Grid: Season vs All-Time */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <RenderList users={seasonUsers} title="Top Season" type="season" />
          <RenderList users={allTimeUsers} title="All-Time Legends" type="allTime" />
        </div>

        {/* Footer Info */}
        <div className="mt-16 p-6 bg-slate-900 rounded-3xl text-white overflow-hidden relative shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Award className="text-yellow-400" size={32} />
              </div>
              <div>
                <h4 className="font-bold text-lg">Kejar Rank Shadow Monarch!</h4>
                <p className="text-slate-400 text-sm">Kumpulkan XP dengan makan sehat dan latihan rutin.</p>
              </div>
            </div>
            <div className="flex gap-4 text-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Workout</p>
                <p className="font-bold text-emerald-400">+50 XP</p>
              </div>
              <div className="w-px h-8 bg-slate-800 self-center"></div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Makan</p>
                <p className="font-bold text-emerald-400">+10 XP</p>
              </div>
              <div className="w-px h-8 bg-slate-800 self-center"></div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Progress</p>
                <p className="font-bold text-emerald-400">+20 XP</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;