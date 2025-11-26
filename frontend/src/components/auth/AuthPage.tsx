import React, { useState } from 'react';
import { api } from '../../api/client';
import type { User } from '../../types';

interface AuthPageProps {
    onAuthenticate: (token: string, user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticate }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuthenticate = async () => {
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                const data = await api.login(email, password);
                const user = await api.getMe(data.access_token);
                onAuthenticate(data.access_token, user);
            } else {
                if (!username) {
                    setError('Username is required');
                    setLoading(false);
                    return;
                }
                await api.register(username, email, password);
                const data = await api.login(email, password);
                const user = await api.getMe(data.access_token);
                onAuthenticate(data.access_token, user);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-[#FFF5F9] flex items-center justify-center relative overflow-hidden">
            <div className="relative z-10 w-full max-w-md px-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="font-medium text-[#FF0066]">imgto3d</h1>

                    <div>
                        <button
                            onClick={() => {
                                setIsLogin(true);
                                setError('');
                            }}
                            className={`font-medium mr-2 cursor-pointer ${isLogin ? 'text-[#FF0066]' : 'text-[#FFB3D9]'}`}
                        >
                            login
                        </button>
                        <span className="text-[#FFB3D9]">/</span>
                        <button
                            onClick={() => {
                                setIsLogin(false);
                                setError('');
                            }}
                            className={`font-medium ml-2 cursor-pointer ${!isLogin ? 'text-[#FF0066]' : 'text-[#FFB3D9]'}`}
                        >
                            sign up
                        </button>
                    </div>
                </div>

                <form
                    className="space-y-6"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleAuthenticate();
                    }}
                >
                    {!isLogin && (
                        <div className="border-2 border-[#FF0066] bg-[#FFC4E1]">
                            <label className="block text-[#FF0066] font-medium p-2 border-b-2 border-[#FF0066]">
                                username:
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-3 bg-[#FFD9ED] text-[#FF0066] font-medium outline-none placeholder-[#FFB3D9]"
                            />
                        </div>
                    )}

                    <div className="border-2 border-[#FF0066] bg-[#FFC4E1]">
                        <label className="block text-[#FF0066] font-medium p-2 border-b-2 border-[#FF0066]">
                            email:
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 bg-[#FFD9ED] text-[#FF0066] font-medium outline-none placeholder-[#FFB3D9]"
                        />
                    </div>

                    <div className="border-2 border-[#FF0066] bg-[#FFC4E1]">
                        <label className="block text-[#FF0066] font-medium p-2 border-b-2 border-[#FF0066]">
                            password:
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 bg-[#FFD9ED] text-[#FF0066] font-medium outline-none placeholder-[#FFB3D9]"
                        />
                    </div>

                    {error && (
                        <div className="text-[#FF0066] font-medium text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="text-[#FF0066] font-medium hover:scale-105 transition-transform cursor-pointer disabled:opacity-50"
                        >
                            {loading ? 'please wait...' : 'authenticate'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
