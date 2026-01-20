import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { d_assets } from '../../configs/assets';
import Icon from "react-native-vector-icons/Ionicons";
import styless from "../../../../styles";

export default function LeComite({ navigation }: any) {
  const committeeMembers = [
    { name: 'Justin AKA', image: d_assets.images.postImg1 },
    { name: 'Ajao MONLOUOLE', image: d_assets.images.postImg1 },
    { name: 'André AMOUSSOU', image: d_assets.images.postImg1 },
    { name: 'Rodrigue CHABI', image: d_assets.images.postImg1 },
    { name: 'Noël DJOSSOU', image: d_assets.images.postImg1 },
    { name: 'Jean KOKOYE', image: d_assets.images.postImg1 },
    { name: 'Koblam MIDODJI', image: d_assets.images.postImg1 },
    { name: 'Tosho OSHOFFA', image: d_assets.images.postImg1 },
    { name: 'Yacinth SARASSORO', image: d_assets.images.postImg1 },
    { name: 'Gabriel SOUMAHO', image: d_assets.images.postImg1 },
    { name: 'Marcellin ZANNOU', image: d_assets.images.postImg1 },
    { name: 'Bertin BADA', image: d_assets.images.postImg1 },
  ];

  const firstRow = committeeMembers.slice(0, 6);
  const secondRow = committeeMembers.slice(6);

  const renderRow = (row: any[]) => (
    
      

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {row.map((member, index) => (
          <View key={index} style={styles.card}>
            <Image source={member.image} style={styles.avatar} />
            <View style={styles.nameContainer}>
              <Text style={styles.name}>{member.name}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
  );

  return (

    <View style={{ flex: 1, backgroundColor: '#F6F7FB' }}>
      <View style={styless.header1}>
        <Image source={d_assets.images.appLogo} style={styless.logo} />
        {/* <Text style={styles.titleSimple2}>{t("home.explore")}</Text> */}

        <View style={styless.headerIcons}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
          >
            <Icon
              name="notifications-outline"
              size={24}
              color="#444"
              style={styless.iconRight}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            <Icon name="settings-outline" size={24} color="#444" />
          </TouchableOpacity>
        </View>
      </View>


          <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.container}
              showsVerticalScrollIndicator={false}
            >
              {/* <Image source={require('../../../assets/images/celeLogo.png')} style={styles.logo} /> */}
              <Text style={styles.title}>Le Sacré Collège</Text>
              <Text style={styles.subtitle}>
                Collège des Pasteurs dirigeants de l'ECC
              </Text>

              {renderRow(firstRow)}

              <Text style={styles.title}>Le CST</Text>
              <Text style={styles.subtitle}>
                Membres du comité supérieure de la transition
              </Text>

              {renderRow(secondRow)}
              {renderRow(firstRow)}

              <Text style={styles.title}>Le Saint Siège</Text>
              <Text style={styles.subtitle}>
                Membres du comité supérieure de la transition
              </Text>

              {renderRow(secondRow)}
          </ScrollView>

    </View>
    
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  container: {
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignContent: 'flex-start',
    alignItems: 'flex-start',
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },

  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },

  row: {
    paddingBottom: 20,
    alignContent: "flex-start",
  },

  card: {
    width: 120,
    height: 160,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 12,
    marginRight: 10,
    alignItems: 'center',

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#EEE',
  },

  nameContainer: {
    backgroundColor: '#F1F3F8',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },

  name: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});
