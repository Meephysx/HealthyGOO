import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Settings, 
  Edit2, 
  Save, 
  Target, 
  AlertCircle,
  CheckCircle2,
  Bell,
  Shield,
  LogOut,
  XCircle,
  Mail,
  Calendar,
  Ruler,
  Scale,
  Activity,
  ChevronRight,
  X,
  Loader2
} from 'lucide-react';
import { calculateBMI, calculateIdealWeight, calculateDailyCalories, getBMICategory } from '../utils/calculations';
import { ACTIVITY_LEVELS, DIETARY_RESTRICTIONS, COMMON_ALLERGIES } from '../utils/constants';
import type { User as UserType } from '../types';
import { auth, db, storage } from '../firebase';
import { getUserProfile } from '../services/firestore';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';

const Profile: React.FC = () => {
  const [user, setUser] = useState<UserType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    activityLevel: '',
    goal: '',
    dietaryRestrictions: [] as string[],
    allergies: [] as string[]
  });
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // --- Photo Upload State ---
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // --- HELPER: Show Notification ---
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- BAGIAN 1: LOAD DATA LEBIH AMAN ---
  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          // Tunggu listener auth state jika user belum terdeteksi
          return;
        }

        const profile = await getUserProfile(currentUser.uid);
        
        if (profile) {
          const parsedUser = profile as unknown as UserType;
          setUser(parsedUser);
          
          setFormData({
            name: parsedUser.fullname || parsedUser.name || '',
            email: parsedUser.email || currentUser.email || '',
            age: parsedUser.age ? String(parsedUser.age) : '',
            gender: parsedUser.gender || 'male',
            height: parsedUser.height ? String(parsedUser.height) : '',
            weight: parsedUser.weight ? String(parsedUser.weight) : '',
            activityLevel: parsedUser.activityLevel || 'moderate',
            goal: parsedUser.goal || 'weight-loss',
            dietaryRestrictions: Array.isArray(parsedUser.dietaryRestrictions) ? parsedUser.dietaryRestrictions : [],
            allergies: Array.isArray(parsedUser.allergies) ? parsedUser.allergies : []
          });
        }
      } catch (err: any) {
        console.error("Gagal memuat profil:", err);
        setError("Gagal memuat data profil. Silakan coba login ulang.");
      } finally {
        setIsLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadUserData();
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);
  
  // --- REFACTORED PHOTO UPLOAD HANDLER ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const currentUser = auth.currentUser;

    if (!file || !currentUser) {
      return;
    }

    // Optimistic UI with a local URL
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    setIsUploading(true);

    try {
      // Consistent storage path, e.g., "profile_photos/USER_UID.jpg"
      const storageRef = ref(storage, `profileimages.jpg/${currentUser.uid}`);
      
      // Await the resumable upload
      const snapshot = await uploadBytesResumable(storageRef, file);
      
      // Get the public URL for the uploaded file
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update user's auth profile (important for auth state consistency)
      await updateProfile(currentUser, { photoURL: downloadURL });

      // Update user's document in Firestore with merge: true to avoid overwriting
      const userDocRef = doc(db, "users", currentUser.uid);
      await setDoc(
        userDocRef,
        { photoURL: downloadURL, updatedAt: new Date() },
        { merge: true }
      );

      // Update local React state for immediate UI feedback
      if (user) {
        const updatedUser = { ...user, photoURL: downloadURL };
        setUser(updatedUser);
        // Also update localStorage if other components rely on it
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      showNotification('success', 'Profile photo updated!');
    } catch (error) {
      console.error("Upload error:", error);
      showNotification('error', 'Upload failed. Please try again.');
      // Revert preview to the original photo on failure
      setPhotoPreview(user?.photoURL || null);
    } finally {
      // This block ALWAYS runs, ensuring the loading spinner stops
      setIsUploading(false);
      // Clean up the created object URL to prevent memory leaks
      URL.revokeObjectURL(objectUrl);
    }
  };

  // --- BAGIAN 2: SIMPAN DATA DENGAN KONVERSI TIPE ---
  const handleSave = async () => {
    if (!user) return;

    // Basic Validation
    if (!formData.name.trim() || !formData.email.trim()) {
      showNotification('error', 'Nama dan Email wajib diisi.');
      return;
    }

    try {
      const heightVal = Number(formData.height) || 0;
      const weightVal = Number(formData.weight) || 0;
      const ageVal = Number(formData.age) || 0;

      if (heightVal <= 0 || weightVal <= 0 || ageVal <= 0) {
        showNotification('error', 'Tinggi, Berat, dan Umur harus angka valid > 0');
        return;
      }

      const bmiVal = calculateBMI(weightVal, heightVal);
      const idealWeightVal = calculateIdealWeight(heightVal, formData.gender as 'male' | 'female');
      
      let dailyCaloriesVal = 0;
      try {
        dailyCaloriesVal = calculateDailyCalories(
          weightVal,
          heightVal,
          ageVal,
          formData.gender as 'male' | 'female',
          formData.activityLevel,
          formData.goal
        );
      } catch (calError) {
        console.warn("Gagal hitung kalori:", calError);
        dailyCaloriesVal = user.dailyCalories || 0;
      }

      const updatedUser: UserType = {
        ...user,
        fullname: formData.name,
        name: formData.name,
        email: formData.email,
        age: ageVal,
        gender: formData.gender as 'male' | 'female',
        height: heightVal,
        weight: weightVal,
        activityLevel: formData.activityLevel as any,
        goal: formData.goal as any,
        dietaryRestrictions: formData.dietaryRestrictions,
        allergies: formData.allergies,
        bmi: bmiVal,
        idealWeight: idealWeightVal,
        dailyCalories: dailyCaloriesVal
      };

      setUser(updatedUser);
      
      // Update LocalStorage for immediate UI updates in other components
      localStorage.setItem('user', JSON.stringify(updatedUser));
      // Update Firestore
      if (auth.currentUser) {
         // Gunakan setDoc merge agar lebih robust
         await setDoc(doc(db, 'users', auth.currentUser.uid), updatedUser, { merge: true });
      }
      
      setIsEditing(false);
      showNotification('success', 'Profil berhasil diperbarui!');

    } catch (error) {
      console.error("Error saving profile:", error);
      showNotification('error', 'Gagal menyimpan perubahan.');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      const keysToRemove = [
          'user', 'workoutPlan', 'completedExercises', 
          'progressEntries', 'favoriteFoods', 'recentFoods'
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      window.location.href = '/';
    } catch (error) {
      console.error("Logout failed:", error);
      showNotification('error', 'Gagal keluar akun');
    }
  };

  const handleCheckboxChange = (value: string, field: 'dietaryRestrictions' | 'allergies') => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const getBmiColorClass = (colorString: string | undefined, type: 'text' | 'bg') => {
    if (!colorString) return type === 'text' ? 'text-gray-600' : 'bg-gray-100';
    const colorBase = colorString.replace('text-', '');
    if (type === 'bg') {
      return `bg-${colorBase.split('-')[0]}-100`; 
    }
    return colorString;
  };

  // --- RENDER STATES ---

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-500 text-sm font-medium">Memuat profil...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border border-red-100">
                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Terjadi Kesalahan</h2>
                <p className="text-gray-600 mb-8 leading-relaxed">{error}</p>
                <div className="flex gap-3 justify-center">
                    <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium">
                        Refresh
                    </button>
                    <button onClick={handleLogout} className="px-6 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-all font-medium">
                        Reset Data
                    </button>
                </div>
            </div>
        </div>
    );
  }

  if (!user) return null;

  const bmiInfo = getBMICategory(user.bmi);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      
      {/* --- TOAST NOTIFICATION --- */}
      {notification && (
        <div className={`fixed top-24 right-4 md:right-8 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border animate-in slide-in-from-right-10 fade-in duration-300 ${
          notification.type === 'success' 
            ? 'bg-white border-green-100 text-green-800' 
            : 'bg-white border-red-100 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <p className="text-sm font-semibold">{notification.message}</p>
          <button onClick={() => setNotification(null)} className="ml-2 opacity-50 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* --- HEADER COVER --- */}
      <div className="h-48 bg-gradient-to-r from-green-600 to-emerald-800 relative">
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        
        {/* --- PROFILE HEADER CARD --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
            
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 w-full">
              {/* Avatar */}
              <div className="relative">
                <div className="w-32 h-32 bg-white rounded-full p-1.5 shadow-md">
                    <div className="w-full h-full rounded-full flex items-center justify-center overflow-hidden relative bg-gray-100">
                        {isUploading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                            </div>
                        )}
                        {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : user.photoURL ? (
                            <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-16 h-16 text-gray-400" />
                        )}
                    </div>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    hidden
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute bottom-1 right-1 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                    aria-label="Change profile photo"
                >
                    <Edit2 size={16} />
                </button>
              </div>
              
              {/* Name & Meta */}
              <div className="flex-1 text-center md:text-left mb-2">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {user.name || 'User'}
                </h1>
                <p className="text-gray-500 font-medium">{user.email}</p>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                    Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
                  </span>
                  {user.bmi && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${getBmiColorClass(bmiInfo.color, 'text')} ${getBmiColorClass(bmiInfo.color, 'bg').replace('bg-', 'border-').replace('100', '200')} bg-opacity-10`}>
                        BMI: {user.bmi} • {bmiInfo.category}
                      </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex w-full md:w-auto gap-3 mt-4 md:mt-0">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 font-medium text-sm"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                        setFormData(prev => ({...prev, name: user.name})); 
                        setIsEditing(false);
                    }}
                    className="flex-1 md:flex-none px-5 py-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 font-medium text-sm"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* --- LEFT COLUMN: FORMS --- */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Personal Information */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <User size={20} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg border-b border-transparent py-1">{user.name}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Mail size={12}/> Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg border-b border-transparent py-1">{user.email}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Calendar size={12}/> Age</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium text-lg border-b border-transparent py-1">{user.age} <span className="text-sm text-gray-400 font-normal">years</span></p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gender</label>
                  {isEditing ? (
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-medium text-lg border-b border-transparent py-1 capitalize">{user.gender}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Ruler size={12}/> Height</label>
                  {isEditing ? (
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.height}
                        onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">cm</span>
                    </div>
                  ) : (
                    <p className="text-gray-900 font-medium text-lg border-b border-transparent py-1">{user.height} <span className="text-sm text-gray-400 font-normal">cm</span></p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Scale size={12}/> Weight</label>
                  {isEditing ? (
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">kg</span>
                    </div>
                  ) : (
                    <p className="text-gray-900 font-medium text-lg border-b border-transparent py-1">{user.weight} <span className="text-sm text-gray-400 font-normal">kg</span></p>
                  )}
                </div>
              </div>
            </div>

            {/* Fitness Goals */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                  <Target size={20} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Fitness Goals</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity Level</label>
                  {isEditing ? (
                    <select
                      value={formData.activityLevel}
                      onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none"
                    >
                      {ACTIVITY_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 py-1">
                      <Activity size={18} className="text-orange-500" />
                      <p className="text-gray-900 font-medium text-lg">
                        {ACTIVITY_LEVELS.find(level => level.value === user.activityLevel)?.label || user.activityLevel}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Primary Goal</label>
                  {isEditing ? (
                    <select
                      value={formData.goal}
                      onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none"
                    >
                      <option value="weight-loss">Weight Loss</option>
                      <option value="weight-gain">Weight Gain</option>
                      <option value="muscle-gain">Muscle Gain</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 py-1">
                      <Target size={18} className="text-orange-500" />
                      <p className="text-gray-900 font-medium text-lg capitalize">{user.goal ? user.goal.replace('-', ' ') : ''}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dietary Preferences */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <CheckCircle2 size={20} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Dietary Preferences</h2>
              </div>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Dietary Restrictions</label>
                  {isEditing ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {DIETARY_RESTRICTIONS.map(restriction => (
                        <label key={restriction} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.dietaryRestrictions.includes(restriction) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                          <input
                            type="checkbox"
                            checked={formData.dietaryRestrictions.includes(restriction)}
                            onChange={() => handleCheckboxChange(restriction, 'dietaryRestrictions')}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300"
                          />
                          <span className="ml-2.5 text-sm font-medium text-gray-700">{restriction}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {user.dietaryRestrictions && user.dietaryRestrictions.length > 0 ? (
                        user.dietaryRestrictions.map(restriction => (
                          <span key={restriction} className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-100 text-sm font-medium rounded-lg">
                            {restriction}
                          </span>
                        ))
                      ) : (
                        <p className="text-gray-400 italic text-sm">No dietary restrictions selected.</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Allergies</label>
                  {isEditing ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {COMMON_ALLERGIES.map(allergy => (
                        <label key={allergy} className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${formData.allergies.includes(allergy) ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                          <input
                            type="checkbox"
                            checked={formData.allergies.includes(allergy)}
                            onChange={() => handleCheckboxChange(allergy, 'allergies')}
                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-gray-300"
                          />
                          <span className="ml-2.5 text-sm font-medium text-gray-700">{allergy}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {user.allergies && user.allergies.length > 0 ? (
                        user.allergies.map(allergy => (
                          <span key={allergy} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-100 text-sm font-medium rounded-lg">
                            {allergy}
                          </span>
                        ))
                      ) : (
                        <p className="text-gray-400 italic text-sm">No known allergies.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN: SIDEBAR --- */}
          <div className="space-y-6">
            
            {/* Health Metrics Widget */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                <Activity className="text-green-600" size={20}/> Health Metrics
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500 font-medium">BMI Score</span>
                  <div className="text-right">
                    <span className={`block font-bold text-lg ${getBmiColorClass(bmiInfo.color, 'text')}`}>
                      {user.bmi || '-'}
                    </span>
                    <span className="text-xs text-gray-400">{bmiInfo.category}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500 font-medium">Ideal Weight</span>
                  <span className="font-bold text-lg text-gray-900">{user.idealWeight || '-'} <span className="text-sm font-normal text-gray-400">kg</span></span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-500 font-medium">Daily Calories</span>
                  <span className="font-bold text-lg text-gray-900">{user.dailyCalories || '-'} <span className="text-sm font-normal text-gray-400">kcal</span></span>
                </div>
              </div>
            </div>

            {/* Goal Progress Widget */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-white/10 rounded-lg mr-3">
                  <Target className="h-5 w-5 text-green-400" />
                </div>
                <h3 className="text-lg font-bold">Your Focus</h3>
              </div>
              <p className="text-2xl font-bold mb-2 capitalize tracking-tight">
                {user.goal ? user.goal.replace('-', ' ') : 'Fitness'} Journey
              </p>
              <div className="text-sm text-gray-400 leading-relaxed">
                Stay consistent with your meal planning and workouts to achieve your {user.goal ? user.goal.replace('-', ' ') : ''} goals!
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs font-medium text-gray-400">
                <span>Current Status</span>
                <span className="text-green-400">Active</span>
              </div>
            </div>

            {/* Account Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Settings</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-xl transition-colors group">
                  <div className="flex items-center">
                    <Bell className="h-5 w-5 text-gray-400 mr-3 group-hover:text-gray-600" />
                    <span className="text-gray-700 font-medium">Notifications</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </button>
                
                <button className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-xl transition-colors group">
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 text-gray-400 mr-3 group-hover:text-gray-600" />
                    <span className="text-gray-700 font-medium">Privacy & Security</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </button>
                
                <div className="h-px bg-gray-100 my-2"></div>

                <button 
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center p-3 text-left hover:bg-red-50 rounded-xl transition-colors text-red-600 group"
                >
                  <LogOut className="h-5 w-5 mr-3 group-hover:text-red-700" />
                  <span className="font-medium group-hover:text-red-700">Sign Out</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-red-50 rounded-full mr-4">
                  <LogOut className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Sign Out?</h3>
              </div>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Are you sure you want to sign out? You'll need to log in again to access your dashboard.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
