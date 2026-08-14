const React = require('react');

const motion = new Proxy(
  {},
  {
    get: (_target, prop) => {
      return React.forwardRef(({ children, ...props }, ref) => {
        const {
          whileHover,
          whileTap,
          whileFocus,
          whileDrag,
          whileInView,
          animate,
          initial,
          exit,
          transition,
          variants,
          ...validProps
        } = props;
        return React.createElement(prop, { ...validProps, ref }, children);
      });
    },
  }
);

const AnimatePresence = ({ children }) => React.createElement(React.Fragment, null, children);

module.exports = {
  motion,
  AnimatePresence,
};
