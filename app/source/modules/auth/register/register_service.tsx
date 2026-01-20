import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

export const registerUserWithProfile = async (form: {
  firstName: string;
  lastName: string;
  parish: string;
  phone: string;
  email: string; 
  password: string;
  country: string;
}) => {
  try {
    // 1. Create auth user
    const res = await auth().createUserWithEmailAndPassword(
      form.email.trim(),
      form.password
    );

    const uid = res.user.uid;

    // 2. Update display name
    await res.user.updateProfile({
      displayName: `${form.firstName} ${form.lastName}`,
    });

    // 3. Save profile in Firestore
    await firestore().collection("users").doc(uid).set({
      firstName: form.firstName,
      lastName: form.lastName,
      parish: form.parish,
      phone: form.phone,
      email: form.email,
      country: form.country,

      isApproved: false, // 🔒 for admin approval
      role: "user",

      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};
