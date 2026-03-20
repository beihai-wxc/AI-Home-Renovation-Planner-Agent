import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";

export const CompareSlider = ({
  original,
  restored,
}: {
  original: string;
  restored: string;
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <ReactCompareSlider
        itemOne={
          <ReactCompareSliderImage 
            src={original} 
            alt="原始房间照片"
            style={{
              filter: "none",
            }}
          />
        }
        itemTwo={
          <ReactCompareSliderImage 
            src={restored} 
            alt="生成后的房间照片"
            style={{
              filter: "none",
            }}
          />
        }
        portrait
        className="w-full h-[400px] rounded-2xl overflow-hidden shadow-apple-lg"
        style={{
          cursor: "col-resize",
        }}
        handle={
          <div className="flex items-center justify-center w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-apple border border-apple-gray-200/50 hover:bg-white hover:shadow-apple-lg transition-all duration-300">
            <svg
              className="w-6 h-6 text-apple-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l4-4 4 4m0 6l-4 4-4-4"
              />
            </svg>
          </div>
        }
      />
      
      {/* 标签 */}
      <div className="flex justify-between mt-4 px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-apple-gray-400" />
          <span className="text-sm text-apple-gray-500 font-medium">改造前</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-apple-blue font-medium">改造后</span>
          <div className="w-3 h-3 rounded-full bg-apple-blue" />
        </div>
      </div>
    </div>
  );
};