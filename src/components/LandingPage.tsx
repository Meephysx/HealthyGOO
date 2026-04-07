import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Mulai animasi (redup -> normal) sesaat setelah mount
    const animTimer = setTimeout(() => {
      setAnimate(true);
    }, 100);

    // Redirect ke menu login (Onboarding) setelah 4 detik
    const redirectTimer = setTimeout(() => {
      navigate('/onboarding');
    }, 4000);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center overflow-hidden">
      <div 
        className={`transition-all duration-[2500ms] ease-out transform flex flex-col items-center ${
          animate 
            ? 'opacity-100 scale-100 blur-0' 
            : 'opacity-20 scale-90 blur-sm'
        }`}
      >
        {/* Logo */}
        <img 
          src="/img/logo.jpg" 
          alt="HealthyGO Logo" 
          className="w-96 h-96 md:w-96 md:h-96 object-contain mb-6"
        />
        <h1 className="text-4xl md:text-5xl font-bold text-green-600 tracking-tight">
          HealthyGO
        </h1>
        <p className="text-gray-600 text-sm md:text-lg mt-2">HealthyGO is a fitness and nutrition app that helps you achieve your fitness goals and stay healthy</p>
      </div>
    </div>
  );
};

export default LandingPage;
