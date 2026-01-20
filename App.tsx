import 'intl';
import 'intl-pluralrules';
import "./i18n"; // or correct relative path
import { enableScreens } from 'react-native-screens';
enableScreens(true);
import "./i18n"; // or correct relative path

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './app/source/configs/navigation';



// import auth from "@react-native-firebase/auth";
// import firestore from "@react-native-firebase/firestore";


// const uid = auth().currentUser?.uid;

// const userDoc = await firestore()
//   .collection("users")
//   .doc(uid!)
//   .get();

// const userProfile = userDoc.data();
// console.log("User Profile:", userProfile);



export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
