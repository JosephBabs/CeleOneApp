import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
// import { Colors } from "../../../../core/theme/colors";
// import { useAppTheme } from "../../../../core/theme/ThemeContext";
import LinearGradient from 'react-native-linear-gradient';
// import Icon from "react-native-vector-icons/Ionicons";

// import { auth, db } from "../firebaseConfig"; // adjust path
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import { updateEmail } from 'firebase/auth';
import { useAppTheme } from '../../../core/theme/ThemeContext';
import { Colors } from '../../../core/theme/colors';
import { auth, db } from '../auth/firebaseConfig';
import { d_assets } from '../../configs/assets';

const UpdateProfileScreen = () => {
  const { t } = useTranslation();
  const { mode } = useAppTheme();
  const isDark = mode === 'dark';

  const textColor = isDark ? Colors.textDark : Colors.textLight;
  const inputBg = isDark ? Colors.inputDark : Colors.inputLight;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    parish: '',
    phone: '',
    email: '',
  });

  // Fetch user data from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (auth.currentUser) {
          const userRef = doc(db, 'user_data', auth.currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setForm(userSnap.data() as any);
          } else {
            console.log('No user document found');
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleInputChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      Alert.alert(
        t('error.error'),
        t('error.fillAllFields') || 'Please fill all fields',
      );
      return;
    }

    setSaving(true);
    try {
      if (auth.currentUser) {
        const userRef = doc(db, 'user_data', auth.currentUser.uid);

        // Update Firestore
        await updateDoc(userRef, form);

        // Update email in Auth if changed
        if (form.email !== auth.currentUser.email) {
          await updateEmail(auth.currentUser, form.email);
        }

        Alert.alert(
          t('success'),
          t('error.profileUpdated') || 'Profile updated successfully!',
        );
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      let message = t('error.updateFailed') || 'Failed to update profile';
      if (error.code === 'auth/requires-recent-login') {
        message =
          t('reauthRequired') ||
          'Please log out and log back in before changing email';
      }
      Alert.alert(t('error.error'), message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#FFF', '#FDFEFF']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.innerContainer}>
          <View style={styles.header1}>
            <Image source={d_assets.images.appLogo} style={styles.logo} />
            <Text style={[styles.title, { color: textColor }]}>
              {t('settings.updateProfile')}
            </Text>
          </View>
          

          {/* First Name */}
          <Text style={[styles.label, { color: textColor }]}>
            {t('firstname')}
          </Text>
          <TextInput
            placeholder={t('firstname')}
            placeholderTextColor="#aaa"
            style={[
              styles.input,
              { backgroundColor: inputBg, color: textColor },
            ]}
            value={form.firstName}
            onChangeText={text => handleInputChange('firstName', text)}
          />

          {/* Last Name */}
          <Text style={[styles.label, { color: textColor }]}>
            {t('lastname')}
          </Text>
          <TextInput
            placeholder={t('lastname')}
            placeholderTextColor="#aaa"
            style={[
              styles.input,
              { backgroundColor: inputBg, color: textColor },
            ]}
            value={form.lastName}
            onChangeText={text => handleInputChange('lastName', text)}
          />

          {/* Parish */}
          <Text style={[styles.label, { color: textColor }]}>
            {t('parishName')}
          </Text>
          <TextInput
            placeholder={t('parishName')}
            placeholderTextColor="#aaa"
            style={[
              styles.input,
              { backgroundColor: inputBg, color: textColor },
            ]}
            value={form.parish}
            onChangeText={text => handleInputChange('parish', text)}
          />

          {/* Phone */}
          <Text style={[styles.label, { color: textColor }]}>{t('phone')}</Text>
          <TextInput
            placeholder={t('phone')}
            placeholderTextColor="#aaa"
            keyboardType="phone-pad"
            style={[
              styles.input,
              { backgroundColor: inputBg, color: textColor },
            ]}
            value={form.phone}
            onChangeText={text => handleInputChange('phone', text)}
          />

          {/* Email */}
          <Text style={[styles.label, { color: textColor }]}>{t('email')}</Text>
          <TextInput
            placeholder={t('emailPlaceholder')}
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
            style={[
              styles.input,
              { backgroundColor: inputBg, color: textColor },
            ]}
            value={form.email}
            onChangeText={text => handleInputChange('email', text)}
          />

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.button, { backgroundColor: Colors.primary }]}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving
                ? t('loading') || 'Saving...'
                : t('save') || 'Enregistrer'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  innerContainer: { flex: 1, padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    // marginBottom: 20,
    textAlign: 'center',
  },
  label: { fontSize: 14, marginBottom: 4, marginTop: 10 },
  input: { padding: 12, borderRadius: 10, fontSize: 16, marginBottom: 12 },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 12,
  },
  buttonText: { color: '#fff', fontSize: 16 },
  logo: {
    height: 40,
    width: 50,
    objectFit: 'contain',
  },
  header1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // marginBlockStart: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    // elevation: 1
  },
});

export default UpdateProfileScreen;
