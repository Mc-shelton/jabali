import './../styles/footer.scss';
import jc_logo from '../../public/graphics/jc_logo.jpg'
import { InstagramOutlined, TikTokOutlined, TwitterOutlined, WhatsAppOutlined, YoutubeOutlined } from '@ant-design/icons';
const Footer = () => {
  return (
   <footer className="footer">
      <div className="main-cont">
        <div className="footer-logo">
            <img src={jc_logo} alt="Jabali Chorale Logo" width="50" height="50"/>
            <small>We’re committed to bringing Jesus, the transforming power of the gospel, to the life of every soul 
                for a full reflection of His image without spot or wrinkle.</small>
        </div>
        <div className="footer-links">
            <div className="footer-link-group">
                <p className="footer-link-title">Navigate</p>
                <p>Home</p>
                <p>About</p>
                <p>Music</p>
                <p>Chorale</p>
                <p>Join</p>
            </div>
            <div className="footer-link-group">
                <p className="footer-link-title">Connect</p>
                <p>Contact</p>
                <p>FAQ</p>
                <p>Press</p>
            </div>
            <div className="footer-link-group">
                <p className="footer-link-title">More</p>
                <p>Partnerships</p>
                <p>Shop</p>
                <p>Gallery</p>

            </div>
        </div>
        <div className="footer-social">
            <a href="#" style={{color: '#24292e'}}><InstagramOutlined style={{fontSize: '20px'}} /></a>
            <a href="#" style={{color: '#24292e'}}><YoutubeOutlined style={{fontSize: '20px'}} /></a>
            <a href="#" style={{color: '#24292e'}}><TwitterOutlined style={{fontSize: '20px'}} /></a>
            <a href="#" style={{color: '#24292e'}}><WhatsAppOutlined style={{fontSize: '20px'}} /></a>
            <a href="#" style={{color: '#24292e'}}><TikTokOutlined style={{fontSize: '20px'}} /></a>
        </div>
      </div>
      <hr className="footer-hr" />
      <small className="footer-copyright">© {new Date().getFullYear()} Jabali Chorale</small>
    </footer>
  );
};

export default Footer;
