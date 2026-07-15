-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : mer. 15 juil. 2026 à 14:38
-- Version du serveur : 9.1.0
-- Version de PHP : 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `blindtest_db`
--

-- --------------------------------------------------------

--
-- Structure de la table `lobby`
--

DROP TABLE IF EXISTS `lobby`;
CREATE TABLE IF NOT EXISTS `lobby` (
  `id` int NOT NULL AUTO_INCREMENT,
  `host_id` int DEFAULT NULL,
  `status` enum('waiting','playing','fineshed') DEFAULT NULL,
  `invite_code` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `host_id` (`host_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stats`
--

DROP TABLE IF EXISTS `stats`;
CREATE TABLE IF NOT EXISTS `stats` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `winrate` float DEFAULT NULL,
  `avg_place` float DEFAULT NULL,
  `games_played` int DEFAULT NULL,
  `score_total` int DEFAULT NULL,
  `correct_guess_song` int DEFAULT NULL,
  `fastest_guess` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `tracks`
--

DROP TABLE IF EXISTS `tracks`;
CREATE TABLE IF NOT EXISTS `tracks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(150) DEFAULT NULL,
  `artist_name` varchar(150) DEFAULT NULL,
  `song_url` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(150) DEFAULT NULL,
  `username` varchar(150) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `spotify_id` varchar(150) NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `expire_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `spotify_id` (`spotify_id`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `email`, `username`, `created_at`, `spotify_id`, `access_token`, `refresh_token`, `expire_at`) VALUES
(1, 'sachot20@gmail.com', 'Test', NULL, 'raxmas', 'BQDPhnLfMC60rLpwMGj3hpSQZgnHLT-SO28L07XHWv9WA-7QX1oVac3knid6Q6qpXsguELMY6zqxI-Fh0WeMBBtQzK7Y0GOLqHfXgqOaP2x4J4ghV4RYQRqZ7uTFGjW1ru61i3Mg06-LfK4A-XbazY5HKPhwGP8hN1xrqFnFeQKSL1vOkfUrCOJsn6bNdA8lEZpNgv-v3tIKM1TpLmGHzUOZhzfVLpReJ-YB8y5I6Q', 'bbd68734cad57908b423ef24a31c823e:ed405d9d441b1e615cc49835375691a588544a8484d94b4de5faf681e790da82706f1884dc8ad51cd547ea70d9a9d4bfae32624702f2b31a82c9116e805eeb51ed3bf01d82bb726b7f2a3207460620624d11b190c1ca59b1c5c420f27fd779ef8add593968d682a4a9dee06eae14a408b5471fc51bb05b588f28ee93b70ed8ca7e0d17dddac4d5e67fc3480186c02529', '2026-06-09 13:13:53');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
