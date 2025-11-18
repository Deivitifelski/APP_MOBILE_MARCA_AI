import Expo
import React
import ReactAppDependencyProvider
import Firebase
import FirebaseMessaging
import UserNotifications
import Foundation
#if canImport(Network)
import Network
#endif
import Darwin

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Inicializar Firebase antes de qualquer outra coisa
    // Verificar se o GoogleService-Info.plist está no bundle
    if let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") {
      print("✅ GoogleService-Info.plist encontrado em: \(path)")
      FirebaseApp.configure()
    } else {
      // Arquivo não está no bundle - tentar carregar do caminho do projeto
      print("⚠️ GoogleService-Info.plist não encontrado no bundle")
      print("📁 Bundle path: \(Bundle.main.bundlePath)")
      print("📁 Resource path: \(Bundle.main.resourcePath ?? "nil")")
      
      // Tentar carregar do caminho do projeto (útil durante desenvolvimento)
      if let projectPath = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist", inDirectory: nil) {
        print("✅ GoogleService-Info.plist encontrado em: \(projectPath)")
        FirebaseApp.configure()
      } else {
        print("❌ ERRO: GoogleService-Info.plist não encontrado!")
        print("💡 SOLUÇÃO: Adicione o arquivo ao projeto Xcode:")
        print("   1. Abra ios/MarcaAI.xcworkspace no Xcode")
        print("   2. Clique com botão direito na pasta MarcaAI")
        print("   3. Selecione 'Add Files to MarcaAI...'")
        print("   4. Selecione ios/MarcaAI/GoogleService-Info.plist")
        print("   5. Marque 'Add to targets: MarcaAI'")
        print("   6. Clique em 'Add'")
        // Tentar configurar mesmo assim (pode funcionar se estiver em outro lugar)
        FirebaseApp.configure()
      }
    }
    
    // Configurar FCM
    Messaging.messaging().delegate = self
    
    // Solicitar permissão para notificações
    UNUserNotificationCenter.current().delegate = self
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
      if granted {
        DispatchQueue.main.async {
          application.registerForRemoteNotifications()
        }
      }
    }
    
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  // Registrar para notificações remotas
  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    // Configurar APNs token para FCM
    Messaging.messaging().apnsToken = deviceToken
  }
  
  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("Falha ao registrar para notificações remotas: \(error.localizedDescription)")
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins
  
  // Função auxiliar para obter IP da máquina
  private func getLocalIPAddress() -> String? {
    var address: String?
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    
    guard getifaddrs(&ifaddr) == 0 else { return nil }
    guard let firstAddr = ifaddr else { return nil }
    
    for ifptr in sequence(first: firstAddr, next: { $0.pointee.ifa_next }) {
      let interface = ifptr.pointee
      let addrFamily = interface.ifa_addr.pointee.sa_family
      
      if addrFamily == UInt8(AF_INET) {
        let name = String(cString: interface.ifa_name)
        if name == "en0" || name == "en1" { // WiFi ou Ethernet
          var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
          getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len),
                     &hostname, socklen_t(hostname.count),
                     nil, socklen_t(0), NI_NUMERICHOST)
          address = String(cString: hostname)
          if address != "127.0.0.1" {
            break
          }
        }
      }
    }
    
    freeifaddrs(ifaddr)
    return address
  }
  
  // Função auxiliar para substituir localhost pelo IP da máquina
  private func replaceLocalhostWithIP(_ url: URL) -> URL? {
    guard let host = url.host, host == "localhost" || host == "127.0.0.1" else {
      return url
    }
    
    // No simulador, localhost funciona, então manter
    #if targetEnvironment(simulator)
    return url
    #else
    // No dispositivo físico, substituir pelo IP da máquina
    if let ipAddress = getLocalIPAddress() {
      var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
      components?.host = ipAddress
      if let newURL = components?.url {
        print("🔄 Substituindo localhost por IP da máquina: \(ipAddress)")
        return newURL
      }
    }
    return url
    #endif
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Configurar RCTBundleURLProvider para usar IP da máquina
    let settings = RCTBundleURLProvider.sharedSettings()
    
    // 1. Tentar obter URL do Metro bundler
    if let metroURL = settings.jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry") {
      // Substituir localhost pelo IP se necessário
      if let correctedURL = replaceLocalhostWithIP(metroURL) {
        print("✅ Usando Metro bundler: \(correctedURL.absoluteString)")
        return correctedURL
      }
    }
    
    // 2. Tentar Metro com diferentes configurações
    let bundleRoots = [".expo/.virtual-metro-entry", "index", "main"]
    for root in bundleRoots {
      if let url = settings.jsBundleURL(forBundleRoot: root) {
        if let correctedURL = replaceLocalhostWithIP(url) {
          print("✅ Usando Metro bundler (root: \(root)): \(correctedURL.absoluteString)")
          return correctedURL
        }
      }
    }
    
    // 3. Tentar construir URL manualmente com IP da máquina
    if let ipAddress = getLocalIPAddress() {
      let bundleURLString = "http://\(ipAddress):8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true"
      if let manualURL = URL(string: bundleURLString) {
        print("✅ Tentando Metro com IP manual: \(bundleURLString)")
        return manualURL
      }
    }
    
    // 4. Fallback: tentar bundle local se Metro não estiver disponível
    let bundleNames = ["main", "index", "AppEntry"]
    for name in bundleNames {
      if let localBundle = Bundle.main.url(forResource: name, withExtension: "jsbundle") {
        print("⚠️ Metro não disponível, usando bundle local: \(name).jsbundle")
        return localBundle
      }
    }
    
    // 5. Tentar encontrar bundle em subdiretórios
    if let resourcePath = Bundle.main.resourcePath {
      let fileManager = FileManager.default
      if let enumerator = fileManager.enumerator(atPath: resourcePath) {
        while let file = enumerator.nextObject() as? String {
          if file.hasSuffix(".jsbundle") {
            let fullPath = (resourcePath as NSString).appendingPathComponent(file)
            if let bundleURL = URL(string: "file://\(fullPath)") {
              print("⚠️ Encontrado bundle em: \(file)")
              return bundleURL
            }
          }
        }
      }
    }
    
    // 6. Último recurso: tentar localhost (funciona no simulador)
    #if targetEnvironment(simulator)
    if let localhostURL = URL(string: "http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true") {
      print("⚠️ Tentando Metro em localhost:8081 (simulador)...")
      return localhostURL
    }
    #endif
    
    print("❌ ERRO: Nenhum bundle JavaScript encontrado!")
    print("💡 SOLUÇÃO 1 (Recomendado): Inicie o Metro bundler")
    print("   Execute: ./start-metro.sh")
    print("   Depois: Clean Build (⇧⌘K) e Run (⌘R)")
    print("")
    print("💡 SOLUÇÃO 2: Gere um bundle local")
    print("   Execute: ./gerar-bundle-local.sh")
    print("   Depois adicione o bundle ao projeto Xcode")
    
    // Retornar nil causará crash, mas pelo menos o usuário verá a mensagem
    return nil
#else
    // Release: sempre usar bundle embutido
    let bundleNames = ["main", "index", "AppEntry"]
    for name in bundleNames {
      if let bundleURL = Bundle.main.url(forResource: name, withExtension: "jsbundle") {
        print("✅ Usando bundle de produção: \(name).jsbundle")
        return bundleURL
      }
    }
    
    print("❌ ERRO: Bundle de produção não encontrado!")
    print("💡 SOLUÇÃO: Gere o bundle com: ./gerar-bundle-local.sh")
    return nil
#endif
  }
}

// MARK: - UNUserNotificationCenterDelegate
extension AppDelegate: UNUserNotificationCenterDelegate {
  // Receber notificação quando o app está em foreground
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    let userInfo = notification.request.content.userInfo
    print("📱 Notificação recebida em foreground: \(userInfo)")
    
    // Mostrar notificação mesmo em foreground
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .badge, .sound])
    } else {
      completionHandler([.alert, .badge, .sound])
    }
  }
  
  // Usuário tocou na notificação
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let userInfo = response.notification.request.content.userInfo
    print("📱 Usuário tocou na notificação: \(userInfo)")
    
    completionHandler()
  }
}

// MARK: - MessagingDelegate
extension AppDelegate: MessagingDelegate {
  // Receber token FCM
  public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    print("📱 Token FCM recebido: \(fcmToken ?? "nil")")
  }
}