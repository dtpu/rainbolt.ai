import { useUser } from '@auth0/nextjs-auth0';
import { useEffect, useState } from 'react';
import { createUserSession, getUserByAuth0Id, updateUserLastActive } from '@/lib/globe-database';

export function useAuth0Firebase() {
    const { user, isLoading, error } = useUser();
    const [firebaseUserId, setFirebaseUserId] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            setFirebaseUserId(null);
            return;
        }

        const syncUserToFirebase = async () => {
            try {
                console.log('🔄 Starting Firebase sync for user:', user.sub);
                
                // Check if user already exists in Firebase
                const existingUser = await getUserByAuth0Id(user.sub!);
                console.log('📋 Existing user check result:', existingUser);

                if (existingUser) {
                    // User exists, just update last active
                    console.log('✅ User exists, updating last active');
                    await updateUserLastActive(existingUser.id);
                    setFirebaseUserId(existingUser.id);
                    console.log('✅ Firebase user ID set:', existingUser.id);
                } else {
                    // Create new user in Firebase
                    console.log('🆕 Creating new user in Firebase');
                    const result = await createUserSession({
                        userId: user.sub!, // Use Auth0 sub as user ID
                        auth0Id: user.sub!,
                        email: user.email!,
                        displayName: user.name || user.email!,
                        profilePicture: user.picture,
                    });
                    console.log('📝 Create user result:', result);

                    if (result.success) {
                        setFirebaseUserId(result.id!);
                        console.log('✅ New Firebase user ID set:', result.id);
                    } else {
                        console.error('❌ Failed to create user:', result.error);
                        setSyncError(result.error || 'Failed to sync user');
                    }
                }
            } catch (err: any) {
                console.error('❌ Firebase sync error:', err);
                console.error('Error details:', {
                    message: err.message,
                    code: err.code,
                    stack: err.stack
                });
                setSyncError(err.message);
            }
        };

        syncUserToFirebase();
    }, [user]);

    return {
        user,
        firebaseUserId,
        isLoading,
        error: error || syncError
    };
}
