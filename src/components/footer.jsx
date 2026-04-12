import { Link } from 'react-router-dom';
import './../styles/footer.scss';
import { InstagramOutlined, TikTokOutlined, TwitterOutlined, WhatsAppOutlined, YoutubeOutlined } from '@ant-design/icons';
import { jcLogoNoBg } from '../assets';
const Footer = () => {
  return (
   <footer className="footer">
      <div className="main-cont">
        <div className="footer-logo">
            <img className="footer-logo-mark" src={jcLogoNoBg} alt="Jabali Chorale Logo" width="50" height="50"/>
            <small>We’re committed to bringing Jesus, the transforming power of the gospel, to the life of every soul 
                for a full reflection of His image without spot or wrinkle.</small>
        </div>
        <div className="footer-links">
            <div className="footer-link-group">
                <p className="footer-link-title">Navigate</p>
                <Link to="/">Home</Link>
                <Link to="/about">About</Link>
                <Link to="/music">Music</Link>
                <Link to="/chorale">Chorale</Link>
                <Link to="/join">Join</Link>
            </div>
            <div className="footer-link-group">
                <p className="footer-link-title">Connect</p>
                <Link to="/contact">Contact</Link>
                <p>FAQ</p>
                <p>Press</p>
            </div>
            <div className="footer-link-group">
                <p className="footer-link-title">More</p>
                <Link to="/partnerships">Partnerships</Link>
                <Link to="/community">JC Community</Link>
                <Link to="/gallery">Gallery</Link>

            </div>
        </div>
        <div className="footer-social">
            <a href="#" style={{color: '#255181'}}><InstagramOutlined style={{fontSize: '20px'}} /></a>
            <a href="#" style={{color: '#255181'}}><YoutubeOutlined style={{fontSize: '20px'}} /></a>
            <a href="#" style={{color: '#255181'}}><TwitterOutlined style={{fontSize: '20px'}} /></a>
            <a href="#" style={{color: '#255181'}}><WhatsAppOutlined style={{fontSize: '20px'}} /></a>
            <a href="#" style={{color: '#255181'}}><TikTokOutlined style={{fontSize: '20px'}} /></a>
        </div>
      </div>
      <hr className="footer-hr" />
      <small className="footer-copyright">© {new Date().getFullYear()} Jabali Chorale</small>
    </footer>
  );
};

export default Footer;
